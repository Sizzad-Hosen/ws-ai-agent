import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function BoIndexPage(): never {
  redirect(ROUTES.bo.dashboard);
}
