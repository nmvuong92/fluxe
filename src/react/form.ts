// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* useForm — form type-safe bind vào 1 contract mutation. Field name suy từ input op (typed).
 * Nguồn-sự-thật validation = SERVER (Zod): submit → nếu 400 code=validation, map
 * details[].path → errors[field] (giữ ràng buộc "0 schema xuống browser"). Tuỳ chọn `schema`
 * (user CHỦ ĐỘNG ship 1 zod) để validate client TRƯỚC submit. */
import { useState } from "react";
import { invalidateQueries } from "./query.ts";

export interface ValidationDetail { path: string; message: string }
export interface ClientSchema { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } }

export interface FormOpts<I, O> {
  initial?: Partial<I>;
  onSuccess?: (out: O) => void;
  onError?: (err: any) => void;
  schema?: ClientSchema;            // opt-in: validate client trước submit (user tự ship zod)
  invalidates?: string[];           // op query cần refetch sau submit thành công
}

export interface FormApi<I, O> {
  values: Partial<I>;
  errors: Partial<Record<keyof I & string, string>>;
  formError: string;
  submitting: boolean;
  register: <K extends keyof I & string>(name: K) => { name: K; value: any; onChange: (e: any) => void };
  setValue: <K extends keyof I & string>(name: K, value: I[K]) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => Promise<O | undefined>;
  reset: () => void;
}

export function detailsToErrors(details: ValidationDetail[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details) if (d.path && d.path !== "(root)" && !out[d.path]) out[d.path] = d.message;
  return out;
}

export function useForm<I extends Record<string, any>, O>(
  _op: string,
  fn: (input: I) => Promise<O>,
  opts: FormOpts<I, O> = {},
): FormApi<I, O> {
  const [values, setValues] = useState<Partial<I>>(opts.initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setValue<K extends keyof I & string>(name: K, value: I[K]) {
    setValues((s) => ({ ...s, [name]: value }));
    setErrors((er) => (er[name] ? (({ [name]: _drop, ...rest }) => rest)(er) : er));
  }

  function register<K extends keyof I & string>(name: K) {
    return {
      name,
      value: (values as any)[name] ?? "",
      onChange: (e: any) => setValue(name, (e?.target ? e.target.value : e) as I[K]),
    };
  }

  async function handleSubmit(e?: { preventDefault?: () => void }): Promise<O | undefined> {
    e?.preventDefault?.();
    setErrors({});
    setFormError("");
    if (opts.schema) {
      const r = opts.schema.safeParse(values);
      if (!r.success && r.error) {
        const fe: Record<string, string> = {};
        for (const i of r.error.issues) { const p = i.path.join("."); if (p && !fe[p]) fe[p] = i.message; }
        setErrors(fe);
        return;
      }
    }
    setSubmitting(true);
    try {
      const out = await fn(values as I);
      if (opts.invalidates) invalidateQueries(opts.invalidates);
      opts.onSuccess?.(out);
      return out;
    } catch (err: any) {
      if (err?.code === "validation" && Array.isArray(err.details)) setErrors(detailsToErrors(err.details));
      else setFormError(err?.message ?? String(err));
      opts.onError?.(err);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setValues(opts.initial ?? {});
    setErrors({});
    setFormError("");
  }

  return { values, errors: errors as FormApi<I, O>["errors"], formError, submitting, register, setValue, handleSubmit, reset };
}
