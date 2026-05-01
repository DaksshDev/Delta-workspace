import { useState } from "react";
import { Hash, Square, Box } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Multiplication Tables ────────────────────────────────────────────────────

function TablesSection() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 19 }, (_, i) => i + 2).map((n) => (
        <Card key={n} className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">
                Table of {n}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-mono">
                ×{n}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-2">
            <div className="space-y-0.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {n} × {m}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {n * m}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Squares ─────────────────────────────────────────────────────────────────

function SquaresSection() {
  return (
    <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
      {Array.from({ length: 29 }, (_, i) => i + 2).map((n) => (
        <Card
          key={n}
          className="flex flex-col items-center justify-center py-4 px-2 text-center"
        >
          <span className="text-xs font-mono text-muted-foreground mb-1">
            {n}²
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {n * n}
          </span>
        </Card>
      ))}
    </div>
  );
}

// ─── Cubes ───────────────────────────────────────────────────────────────────

function CubesSection() {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
      {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
        <Card
          key={n}
          className="flex flex-col items-center justify-center py-5 px-2 text-center"
        >
          <span className="text-xs font-mono text-muted-foreground mb-1">
            {n}³
          </span>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {n * n * n}
          </span>
        </Card>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BasicMaths() {
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Basic Maths
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Tables · Squares · Cubes — quick reference
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tables">
        <TabsList className="mb-4">
          <TabsTrigger value="tables" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Tables
          </TabsTrigger>
          <TabsTrigger value="squares" className="gap-1.5">
            <Square className="h-3.5 w-3.5" />
            Squares
          </TabsTrigger>
          <TabsTrigger value="cubes" className="gap-1.5">
            <Box className="h-3.5 w-3.5" />
            Cubes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables">
          <TablesSection />
        </TabsContent>
        <TabsContent value="squares">
          <SquaresSection />
        </TabsContent>
        <TabsContent value="cubes">
          <CubesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}