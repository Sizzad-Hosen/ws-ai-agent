import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function HomePage(): never {
  redirect(ROUTES.bo.dashboard);
}
