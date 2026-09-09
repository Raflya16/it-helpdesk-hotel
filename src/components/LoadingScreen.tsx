export function LoadingScreen({
  text = "Loading...",
}: {
  text?: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7fb",
        color: "#667085",
        fontWeight: 700,
      }}
    >
      {text}
    </main>
  );
}
