let storageMutation = Promise.resolve<unknown>(undefined);

export function serializeStorageMutation<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  const next = storageMutation.then(operation, operation);
  storageMutation = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
