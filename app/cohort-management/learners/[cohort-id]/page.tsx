import { redirect } from "next/navigation";

export default function CohortLearnersRedirect({
  params,
}: {
  params: { "cohort-id": string };
}) {
  redirect(`/codes/${params["cohort-id"]}`);
}
