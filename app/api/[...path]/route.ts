import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import * as store from "@/lib/db";
import { checkOrigin, failure, readJSON } from "@/lib/http";
import { dateKey, getSingaporeNow } from "@/lib/timezone";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path;
    const route = path.join("/"),
      method = req.method;
    if (route === "health" && method === "GET") {
      store.db().prepare("SELECT 1").get();
      return NextResponse.json({ status: "ok" });
    }
    const session = await getSession();
    if (!session) throw new store.AppError("Not authenticated", 401);
    if (method !== "GET") checkOrigin(req);
    const user = session.userId;
    const id = Number(path[1]);
    if (
      path.length >= 2 &&
      ["todos", "tags", "templates", "subtasks"].includes(path[0]) &&
      !["export", "import"].includes(path[1]) &&
      (!Number.isSafeInteger(id) || id < 1)
    )
      throw new store.AppError("Invalid ID");
    const data =
      method === "POST" ||
      method === "PUT" ||
      (method === "DELETE" && path[2] === "tags")
        ? await readJSON(req)
        : {};
    let result: unknown;
    if (route === "todos/export" && method === "GET") {
      const format = req.nextUrl.searchParams.get("format") || "json";
      if (!["json", "csv"].includes(format))
        throw new store.AppError("Unsupported export format");
      return new NextResponse(
        format === "csv"
          ? store.csvData(user)
          : JSON.stringify(store.exportData(user), null, 2),
        {
          headers: {
            "Content-Type":
              format === "csv" ? "text/csv; charset=utf-8" : "application/json",
            "Content-Disposition": `attachment; filename="todos-${dateKey(getSingaporeNow())}.${format}"`,
            "Cache-Control": "no-store",
          },
        },
      );
    } else if (route === "todos/import" && method === "POST")
      result = { imported: store.importData(user, data) };
    else if (route === "todos" && method === "GET")
      result = store.listTodos(user);
    else if (route === "todos" && method === "POST")
      result = store.createTodo(user, data);
    else if (
      path[0] === "todos" &&
      path.length === 2 &&
      Number.isSafeInteger(id) &&
      id > 0
    ) {
      if (method === "GET") result = store.getTodo(user, id);
      else if (method === "PUT") result = store.updateTodo(user, id, data);
      else if (method === "DELETE") {
        store.deleteTodo(user, id);
        result = { ok: true };
      }
    } else if (
      path[0] === "todos" &&
      path[2] === "subtasks" &&
      path.length === 3 &&
      method === "POST"
    )
      result = store.saveSubtask(user, id, data);
    else if (
      path[0] === "todos" &&
      path[2] === "tags" &&
      path.length === 3 &&
      ["POST", "DELETE"].includes(method)
    ) {
      const todo = store.getTodo(user, id);
      const tag = Number(data.tag_id);
      if (!Number.isSafeInteger(tag) || tag <= 0)
        throw new store.AppError("Invalid tag ID");
      result = store.updateTodo(user, id, {
        tag_ids:
          method === "POST"
            ? [...todo.tags.map((t) => t.id), tag]
            : todo.tags.filter((t) => t.id !== tag).map((t) => t.id),
      });
    } else if (
      path[0] === "subtasks" &&
      path.length === 2 &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const row = store
        .db()
        .prepare(
          "SELECT s.todo_id FROM subtasks s JOIN todos t ON t.id=s.todo_id WHERE s.id=? AND t.user_id=?",
        )
        .get(id, user) as { todo_id: number } | undefined;
      if (!row) throw new store.AppError("Subtask not found", 404);
      if (method === "PUT")
        result = store.saveSubtask(user, row.todo_id, data, id);
      else {
        store.deleteSubtask(user, row.todo_id, id);
        result = { ok: true };
      }
    } else if (route === "tags" && method === "GET")
      result = store.listTags(user);
    else if (route === "tags" && method === "POST")
      result = store.saveTag(user, data);
    else if (path[0] === "tags" && path.length === 2 && method === "PUT")
      result = store.saveTag(user, data, id);
    else if (path[0] === "tags" && path.length === 2 && method === "DELETE") {
      store.deleteTag(user, id);
      result = { ok: true };
    } else if (route === "templates" && method === "GET")
      result = store.listTemplates(user);
    else if (route === "templates" && method === "POST")
      result = store.saveTemplate(user, data);
    else if (path[0] === "templates" && path.length === 2 && method === "PUT")
      result = store.saveTemplate(user, data, id);
    else if (
      path[0] === "templates" &&
      path.length === 2 &&
      method === "DELETE"
    ) {
      store.deleteTemplate(user, id);
      result = { ok: true };
    } else if (
      path[0] === "templates" &&
      path[2] === "use" &&
      path.length === 3 &&
      method === "POST"
    )
      result = store.useTemplate(user, id);
    else if (route === "holidays" && method === "GET")
      result = store
        .db()
        .prepare("SELECT date,name FROM holidays ORDER BY date")
        .all();
    else if (route === "notifications/check" && method === "GET") {
      checkOrigin(req);
      result = store.claimNotifications(user);
    }
    if (result === undefined) throw new store.AppError("Not found", 404);
    return NextResponse.json(result, {
      status:
        method === "POST" && ["todos", "tags", "templates"].includes(route)
          ? 201
          : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
