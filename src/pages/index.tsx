import { nanoid } from "nanoid";

function Page() {
  return "";
}

export async function getServerSideProps() {
  const newRoomID = nanoid(6);
  return {
    redirect: {
      destination: `/d/${newRoomID}`,
      permanent: false,
    },
  };
}

export default Page;
