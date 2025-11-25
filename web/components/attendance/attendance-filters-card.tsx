"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AttendanceFilters {
    search: string;
    bossName: string;
    mapName: string;
}

interface AttendanceFiltersCardProps {
    filters: AttendanceFilters;
    onFiltersChange: (filters: AttendanceFilters) => void;
    onReset: () => void;
}

export function AttendanceFiltersCard({
    filters,
    onFiltersChange,
    onReset,
}: AttendanceFiltersCardProps) {
    const hasActiveFilters = filters.search || filters.bossName || filters.mapName;

    return (
        <Card>
            <CardContent className="grid gap-4 py-6 md:grid-cols-4">
                <div>
                    <Label>Search</Label>
                    <Input
                        placeholder="Boss or map"
                        value={filters.search}
                        onChange={(e) =>
                            onFiltersChange({ ...filters, search: e.target.value })
                        }
                    />
                </div>
                <div>
                    <Label>Boss</Label>
                    <Input
                        value={filters.bossName}
                        onChange={(e) =>
                            onFiltersChange({ ...filters, bossName: e.target.value })
                        }
                        placeholder="e.g. Yeti King"
                    />
                </div>
                <div>
                    <Label>Map</Label>
                    <Input
                        value={filters.mapName}
                        onChange={(e) =>
                            onFiltersChange({ ...filters, mapName: e.target.value })
                        }
                        placeholder="e.g. Frozen Plateau"
                    />
                </div>
                <div className="flex items-end justify-end">
                    <Button
                        variant="outline"
                        onClick={onReset}
                        disabled={!hasActiveFilters}
                    >
                        Reset filters
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
