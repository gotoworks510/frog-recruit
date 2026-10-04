/** Only deliberately authored messages may leave the server. Never echo DB/network errors. */
export class SalesInputError extends Error {}

export function salesFailure(error: unknown): { error: string } {
  if (error instanceof SalesInputError) return { error:error.message };
  return { error:"保存できませんでした。入力・重複・接続状態を確認し、画面を再読み込みしてください。" };
}
