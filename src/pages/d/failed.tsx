export default function Home() {
  return (
    <div>
      <h2>Failed to create room</h2>
      Something went wrong creating a new room.
      <br />
      Please{" "}
      <a
        style={{ textDecoration: "underline" }}
        href="https://replicache.dev/#contact"
      >
        contact us
      </a>{" "}
      to report the problem. Sorry!
    </div>
  );
}
