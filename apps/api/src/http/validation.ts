import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

export function parseRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      messageKey: "errors.validationFailed",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code
      }))
    });
  }
  return result.data;
}
