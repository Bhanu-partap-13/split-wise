"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Users, Search, UserPlus, Trash2, Shield, Loader2 } from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
}

export function MembersList({ groupId, currentUser }: Props) {
  const members = useQuery(api.groups.getGroupMembers, { groupId });
  const addMember = useMutation(api.groups.addMember);
  const removeMember = useMutation(api.groups.removeMember);
  
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const { toast } = useToast();
  
  const foundUser = useQuery(
    api.users.searchByEmail, 
    searchEmail ? { email: searchEmail } : "skip"
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSearchLoading(true);
    setSearchEmail(email.trim());
    // Artificial slight delay to show load state feedback nicely
    setTimeout(() => {
      setSearchLoading(false);
    }, 400);
  };

  const handleAdd = async () => {
    if (!foundUser) {
      toast({ title: "User not found", variant: "destructive" });
      return;
    }
    try {
      await addMember({ groupId, userId: foundUser._id });
      toast({ title: `${foundUser.name} added to group!` });
      setEmail("");
      setSearchEmail("");
    } catch (err) {
      toast({
        title: "Error adding member",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  if (members === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 text-soft-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 text-white w-full">
      {/* List Card */}
      <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white lg:col-span-3 shadow-md">
        <CardHeader className="border-b border-subtle-blue-gray/25 pb-4">
          <CardTitle className="text-base font-bold font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-soft-teal" />
            Group Members ({members?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-1 divide-y divide-subtle-blue-gray/15">
            {members.map((m) => m.user && (
              <div key={m._id} className="flex items-center justify-between py-4.5 first:pt-0 last:pb-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9 border border-subtle-blue-gray">
                    <AvatarImage src={m.user.avatarUrl} />
                    <AvatarFallback className="bg-soft-teal/10 text-soft-teal text-xs font-bold font-heading">
                      {m.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm font-heading truncate">
                      {m.user.name}
                    </div>
                    <div className="text-xs text-brand-gray truncate">
                      {m.user.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-subtle-blue-gray/60 text-brand-gray flex items-center gap-1">
                    {m.role === "admin" && <Shield className="w-3 h-3 text-soft-teal" />}
                    {m.role}
                  </span>
                  
                  {m.userId !== currentUser?._id && (
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={async () => {
                        await removeMember({ groupId, userId: m.userId });
                        toast({ title: "Member removed from group" });
                      }}
                      className="text-brand-gray hover:text-red-400 hover:bg-red-500/10 w-8 h-8 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Card */}
      <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white lg:col-span-2 shadow-md h-fit">
        <CardHeader className="border-b border-subtle-blue-gray/25 pb-4">
          <CardTitle className="text-base font-bold font-heading">Add Member</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/40 focus-visible:ring-soft-teal text-xs"
              required
            />
            <Button type="submit" variant="outline" className="border-subtle-blue-gray hover:bg-subtle-blue-gray/30 text-white shrink-0 text-xs">
              <Search className="w-4 h-4" />
            </Button>
          </form>

          {searchLoading ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-soft-teal" />
            </div>
          ) : foundUser ? (
            <div className="flex items-center justify-between p-4 bg-deep-navy/40 border border-subtle-blue-gray/30 rounded-xl gap-3">
              <div className="min-w-0">
                <div className="font-bold text-white text-sm font-heading truncate">
                  {foundUser.name}
                </div>
                <div className="text-xs text-brand-gray truncate">
                  {foundUser.email}
                </div>
              </div>
              <Button 
                onClick={handleAdd} 
                size="sm" 
                className="bg-soft-teal hover:bg-soft-teal/80 text-deep-navy font-bold text-xs shrink-0 flex items-center gap-1 shadow-lg shadow-soft-teal/15 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
          ) : (
            searchEmail && (
              <p className="text-xs text-brand-gray/60 italic text-center py-4">
                No user found registered under &quot;{searchEmail}&quot;.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
