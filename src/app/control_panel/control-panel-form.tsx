"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authenticateAdmin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full" size="lg" disabled={pending}>
      {pending ? "Verifying…" : "Enter control panel"}
    </Button>
  );
}

export function ControlPanelForm() {
  const [state, formAction] = useActionState(authenticateAdmin, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="identifier">Admin ID</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          className="h-11 font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">NID number</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          required
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adminPassword">Password</Label>
        <Input
          id="adminPassword"
          name="adminPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
        <p className="text-muted-foreground text-xs">
          All three are required. Members sign in on the main page instead.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
