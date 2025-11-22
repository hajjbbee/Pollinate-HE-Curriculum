import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, MapPin, BookOpen, Users, Calendar, TrendingUp, AlertCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">Pollinate</h1>
              <p className="text-xs text-muted-foreground">Home Education Curriculum</p>
            </div>
          </div>
          <Button asChild variant="default" data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto mb-8 bg-gradient-to-r from-yellow-100 to-amber-50 border-2 border-yellow-600 rounded-lg p-4" data-testid="alert-beta-launch">
            <div className="flex items-center justify-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-700 shrink-0" />
              <p className="text-center text-yellow-900 font-semibold text-base">
                Beta Launch: 200 spots at $29/mo – raising next week. Sign up now!
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground tracking-tight mb-6">
              Living, Interest-Led Homeschool<br />Curriculum for Your Family
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              AI-powered 12-week rolling curricula tailored to each child's interests, mastery levels, and local educational opportunities. Supporting homeschool families globally.
            </p>
            <Button asChild size="lg" className="text-lg px-8" data-testid="button-get-started">
              <a href="/api/login">Get Started Free</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-2">AI-Powered Personalization</h3>
                <p className="text-muted-foreground">
                  Hybrid of Charlotte Mason, Montessori, and unschooling methods. Depth over breadth—when a child shows interest, we dive deep.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-2">Local Opportunities</h3>
                <p className="text-muted-foreground">
                  Discover 3–8 hyper-local educational opportunities each week—museums, libraries, maker spaces, farms, and historical sites.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-2">Multi-Child Family Focus</h3>
                <p className="text-muted-foreground">
                  Age-differentiated activities within family themes. Link siblings with shared activities while honoring individual learning styles.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple onboarding process
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-heading font-bold text-primary">1</span>
              </div>
              <h3 className="font-heading font-semibold mb-2">Create Your Family Profile</h3>
              <p className="text-sm text-muted-foreground">
                Add family name, location, and travel preferences
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-heading font-bold text-primary">2</span>
              </div>
              <h3 className="font-heading font-semibold mb-2">Add Your Children</h3>
              <p className="text-sm text-muted-foreground">
                Name, age, interests, and learning styles for each child
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-heading font-bold text-primary">3</span>
              </div>
              <h3 className="font-heading font-semibold mb-2">Generate Curriculum</h3>
              <p className="text-sm text-muted-foreground">
                AI creates your personalized 12-week rolling curriculum
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-heading font-bold text-primary">4</span>
              </div>
              <h3 className="font-heading font-semibold mb-2">Live & Learn</h3>
              <p className="text-sm text-muted-foreground">
                Follow weekly plans, journal progress, explore local opportunities
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <BookOpen className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-heading font-semibold mb-1">Mastery-Based Learning</h3>
              <p className="text-sm text-muted-foreground">Exposure → Developing → Strong → Mastery → Mentor</p>
            </div>

            <div className="text-center">
              <Calendar className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-heading font-semibold mb-1">12-Week Rolling Curriculum</h3>
              <p className="text-sm text-muted-foreground">Always adapting to your children's growth and interests</p>
            </div>

            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-heading font-semibold mb-1">Progress Tracking</h3>
              <p className="text-sm text-muted-foreground">Daily journal entries with photos to document learning</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-6">
            Ready to Transform Your Homeschool?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join families across three continents using Pollinate to create meaningful, personalized learning experiences.
          </p>
          <Button asChild size="lg" className="text-lg px-8" data-testid="button-start-now">
            <a href="/api/login">Start Your Free Trial</a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-12 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>© 2025 Pollinate. Supporting homeschool families globally.</p>
        </div>
      </footer>
    </div>
  );
}
