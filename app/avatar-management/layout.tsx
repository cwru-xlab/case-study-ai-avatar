export default function AvatarManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-8 md:py-10 px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">{children}</div>
    </section>
  );
}
