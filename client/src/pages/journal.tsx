import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@/components/ObjectUploader";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Calendar, Image as ImageIcon, BookOpen, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UploadResult } from "@uppy/core";
import type { JournalEntry } from "@shared/schema";

const journalEntrySchema = z.object({
  childId: z.string().min(1, "Please select a child"),
  entryDate: z.string().min(1, "Date is required"),
  content: z.string().min(10, "Please write at least 10 characters"),
});

type JournalEntryForm = z.infer<typeof journalEntrySchema>;

export default function Journal() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    retry: false,
    enabled: !!user,
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    retry: false,
    enabled: !!user,
  });

  const form = useForm<JournalEntryForm>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      childId: "",
      entryDate: new Date().toISOString().split("T")[0],
      content: "",
    },
  });

  const { mutate: createEntry, isPending } = useMutation({
    mutationFn: async (data: JournalEntryForm & { photoUrls: string[] }) => {
      const response = await apiRequest("POST", "/api/journal", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      form.reset({
        childId: "",
        entryDate: new Date().toISOString().split("T")[0],
        content: "",
      });
      setUploadedPhotos([]);
      toast({
        title: "Entry Saved",
        description: "Journal entry has been saved successfully!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save journal entry",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    const uploadedUrls = result.successful.map((file) => file.uploadURL);
    setUploadedPhotos((prev) => [...prev, ...uploadedUrls]);

    for (const url of uploadedUrls) {
      try {
        await apiRequest("PUT", "/api/journal-photos", { photoURL: url });
      } catch (error) {
        console.error("Failed to set photo ACL:", error);
      }
    }

    toast({
      title: "Photos Uploaded",
      description: `${uploadedUrls.length} photo(s) uploaded successfully!`,
    });
  };

  const onSubmit = (data: JournalEntryForm) => {
    createEntry({ ...data, photoUrls: uploadedPhotos });
  };

  if (childrenLoading || entriesLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const getChildName = (childId: string) => {
    return children?.find((c: any) => c.id === childId)?.name || "Unknown";
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Learning Journal</h1>
              <p className="text-muted-foreground">Document your children's daily progress</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  New Entry
                </CardTitle>
                <CardDescription>Add today's learning highlights</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="childId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Child</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-child">
                                <SelectValue placeholder="Select child" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {children?.map((child: any) => (
                                <SelectItem key={child.id} value={child.id}>
                                  {child.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="entryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entry</FormLabel>
                          <FormControl>
                            <RichTextEditor
                              content={field.value}
                              onChange={field.onChange}
                              placeholder="What did they learn today? What excited them?"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Photos</Label>
                      <ObjectUploader
                        maxNumberOfFiles={5}
                        maxFileSize={10485760}
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleUploadComplete}
                        buttonClassName="w-full"
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Add Photos ({uploadedPhotos.length})
                      </ObjectUploader>
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full" data-testid="button-save-entry">
                      {isPending ? "Saving..." : "Save Entry"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-xl font-heading font-semibold mb-4">Recent Entries</h2>
            {entries && entries.length > 0 ? (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <Card key={entry.id} className="hover-elevate">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-heading text-lg">
                          {getChildName(entry.childId)}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {new Date(entry.entryDate).toLocaleDateString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="prose prose-sm max-w-none text-muted-foreground" 
                        dangerouslySetInnerHTML={{ __html: entry.content }}
                      />
                      {entry.photoUrls && entry.photoUrls.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-4">
                          {entry.photoUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="aspect-square rounded-lg overflow-hidden bg-muted"
                            >
                              <img
                                src={url}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No journal entries yet. Start documenting your learning journey!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
