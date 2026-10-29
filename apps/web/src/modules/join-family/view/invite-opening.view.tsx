import { Skeleton } from "@/modules/ui";

export function InviteOpening() {
  return (
    <main
      aria-busy
      className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 pt-safe-top pb-safe-bottom"
    >
      <h1 className="sr-only">Открываем приглашение</h1>
      <div className="flex w-full flex-col items-center gap-2">
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="mt-1 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-11 w-full max-w-xs rounded-lg" />
    </main>
  );
}
