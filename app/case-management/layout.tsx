export default function CaseManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-8 md:py-10 w-full">
      {children}
    </section>
  );
}
