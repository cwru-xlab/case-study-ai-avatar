import { redirect } from "next/navigation";

export default function CohortEditRedirect({
  params,
}: {
  params: { "cohort-id": string };
}) {
  redirect(`/codes/${params["cohort-id"]}/edit`);
}
