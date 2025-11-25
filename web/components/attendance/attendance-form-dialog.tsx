"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AttendancePayload } from "@/lib/api/attendance";
import type { Member, AttendanceDetail } from "@/lib/types";

interface AttendanceFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    members: Member[];
    sessionId: string | null;
    initialDetail: AttendanceDetail | null;
    onSubmit: (payload: AttendancePayload) => void;
    isSubmitting: boolean;
}

export function AttendanceFormDialog({
    open,
    onOpenChange,
    members,
    sessionId,
    initialDetail,
    onSubmit,
    isSubmitting,
}: AttendanceFormDialogProps) {
    // TODO: Implement full form dialog
    // For now, this is a placeholder to prevent errors

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{sessionId ? "Edit Attendance" : "Record Attendance"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Form dialog implementation in progress. Please use the existing attendance page functionality.
                    </p>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
