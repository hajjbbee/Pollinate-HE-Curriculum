import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings as SettingsIcon, LogOut, MapPin, Users, Calendar } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  const { data: familyData, isLoading: familyLoading } = useQuery({
    queryKey: ["/api/family"],
    retry: false,
    enabled: !!user,
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    retry: false,
    enabled: !!user,
  });

  if (familyLoading || childrenLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (birthdate: string) => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your account and family information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Account</CardTitle>
            <CardDescription>Your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.profileImageUrl} />
                <AvatarFallback className="text-lg">
                  {getInitials(`${user?.firstName || ""} ${user?.lastName || ""}`)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-lg">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" asChild data-testid="button-logout">
              <a href="/api/logout">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </a>
            </Button>
          </CardContent>
        </Card>

        {familyData && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Family Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Family Name</p>
                <p className="font-semibold">{familyData.familyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                <p className="font-semibold">
                  {familyData.city}, {familyData.state} {familyData.postalCode}
                </p>
                <p className="text-sm text-muted-foreground">{familyData.country}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Travel Radius</p>
                <p className="font-semibold">{familyData.travelRadiusMinutes} minutes</p>
                {familyData.flexForHighInterest && (
                  <p className="text-sm text-primary">Flex for high interest enabled</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {children && children.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Children</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {children.map((child: any) => (
                  <Card key={child.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-heading font-semibold text-lg">{child.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Age {calculateAge(child.birthdate)}
                          </p>
                        </div>
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      {child.interests && child.interests.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Interests</p>
                          <div className="flex flex-wrap gap-1">
                            {child.interests.map((interest: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {child.learningStyle && (
                        <p className="text-xs text-muted-foreground">
                          Learning Style: {child.learningStyle}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
