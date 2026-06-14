"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewGroup() {
  const { convexUser, isLoaded } = useCurrentUser();
  const createGroup = useMutation(api.groups.create);
  const router = useRouter();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convexUser || !name.trim()) return;
    setLoading(true);
    try {
      const id = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        createdBy: convexUser._id,
        currency,
      });
      toast({ title: "Group created successfully!" });
      router.push(`/dashboard/groups/${id}`);
    } catch (err) {
      toast({
        title: "Error creating group",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-soft-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm text-brand-gray hover:text-white self-start transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-heading">
          Create a New Group
        </h1>
        <p className="text-brand-gray text-sm">
          Set up a group to start adding and splitting shared expenses.
        </p>
      </div>

      <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brand-gray text-sm font-semibold">Group Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flat 3B Roommates, Weekend Roadtrip"
                className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/40 focus-visible:ring-soft-teal"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-brand-gray text-sm font-semibold">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/40 focus-visible:ring-soft-teal"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-brand-gray text-sm font-semibold">Default Currency</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-subtle-blue-gray rounded-md bg-deep-navy text-white px-3 py-2.5 text-sm focus:border-soft-teal focus:outline-none"
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-electric-blue hover:bg-electric-blue/80 text-white font-bold py-6 flex items-center gap-2 shadow-lg shadow-electric-blue/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Create Group
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
