"use server"

import { getCurrentUser } from "../actions";
import { Role } from "@prisma/client";
import PageClient from "./PageClient";

export default async function Page() {
  const user = await getCurrentUser();
  const userRole = user?.role || Role.USER;

  return <PageClient userRole={userRole} />;
}
