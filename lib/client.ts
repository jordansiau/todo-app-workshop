export async function api<T = unknown>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    // Reload the document to clear all in-memory data after session expiry.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401) window.location.assign("/login");
    throw new Error(data.error || "Request failed");
  }
  return data;
}
