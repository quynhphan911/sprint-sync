// Team dashboard — implemented by the sprint-dashboard-review spec
export default function TeamDashboardPage({ params }: { params: { teamId: string } }) {
  return (
    <main className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-semibold text-foreground">Team Dashboard</h1>
      <p className="mt-2 text-sm text-foreground/60">Team ID: {params.teamId}</p>
    </main>
  )
}
