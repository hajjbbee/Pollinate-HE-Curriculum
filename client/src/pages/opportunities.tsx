import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleMap } from "@/components/GoogleMap";
import { MapPin, ExternalLink, Phone, DollarSign, Clock, Map, List } from "lucide-react";
import type { LocalOpportunity } from "@shared/schema";

export default function Opportunities() {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "map">("list");

  const { data: opportunities, isLoading } = useQuery<LocalOpportunity[]>({
    queryKey: ["/api/opportunities"],
    retry: false,
    enabled: !!user,
  });

  const { data: familyData } = useQuery({
    queryKey: ["/api/family"],
    retry: false,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const distanceUnit = familyData?.country === "US" ? "miles" : "km";
  const convertDistance = (minutes: number) => {
    const avgSpeed = familyData?.country === "US" ? 40 : 65;
    return Math.round((minutes / 60) * avgSpeed);
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Local Opportunities</h1>
              <p className="text-muted-foreground">
                Educational experiences near you in {familyData?.city}, {familyData?.state}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {opportunities && opportunities.length > 0 ? (
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6" data-testid="tabs-view">
              <TabsTrigger value="list" data-testid="tab-list">
                <List className="w-4 h-4 mr-2" />
                List View
              </TabsTrigger>
              <TabsTrigger value="map" data-testid="tab-map">
                <Map className="w-4 h-4 mr-2" />
                Map View
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="list">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {opportunities.map((opp) => (
              <Card key={opp.id} className="hover-elevate active-elevate-2 flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-lg line-clamp-2">{opp.name}</CardTitle>
                    {opp.category && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {opp.category}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{opp.address}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 space-y-2">
                    {opp.driveMinutes && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>
                          {opp.driveMinutes} min drive (~{convertDistance(opp.driveMinutes)} {distanceUnit})
                        </span>
                      </div>
                    )}
                    {opp.cost && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-primary">{opp.cost}</span>
                      </div>
                    )}
                    {opp.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary" />
                        <a href={`tel:${opp.phone}`} className="hover:underline">
                          {opp.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {opp.website && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={opp.website} target="_blank" rel="noopener noreferrer" data-testid={`link-website-${opp.id}`}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Visit Website
                        </a>
                      </Button>
                    )}
                    {opp.latitude && opp.longitude && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${opp.latitude},${opp.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-directions-${opp.id}`}
                        >
                          <MapPin className="w-4 h-4 mr-1" />
                          Directions
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="map" className="mt-0">
              <Card>
                <CardContent className="p-0">
                  <div className="h-[600px]">
                    <GoogleMap
                      center={{
                        lat: familyData?.latitude || 0,
                        lng: familyData?.longitude || 0,
                      }}
                      markers={opportunities.map((opp) => ({
                        id: opp.id,
                        lat: opp.latitude!,
                        lng: opp.longitude!,
                        name: opp.name,
                        address: opp.address,
                        category: opp.category || undefined,
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No opportunities cached yet. Your weekly curriculum will include personalized local opportunities!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
