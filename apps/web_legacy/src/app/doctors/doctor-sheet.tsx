"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DOCTOR_TITLES = [
  "主任医师",
  "副主任医师",
  "主治医师",
  "住院医师",
  "其他",
];

interface Hospital {
  id: number;
  name: string;
}

interface DoctorFormData {
  name: string;
  hospitalId: number | null;
  department: string;
  title: string;
  specialty: string;
  phone: string;
  notes: string;
}

interface Doctor {
  id: number;
  name: string;
  hospitalId: number;
  department: string | null;
  title: string | null;
  specialty: string | null;
  phone: string | null;
  notes: string | null;
}

interface DoctorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor?: Doctor | null;
  hospitals: Hospital[];
  onSuccess?: () => void;
}

function createFormData(doctor: Doctor | null | undefined): DoctorFormData {
  if (doctor) {
    return {
      name: doctor.name,
      hospitalId: doctor.hospitalId,
      department: doctor.department ?? "",
      title: doctor.title ?? "",
      specialty: doctor.specialty ?? "",
      phone: doctor.phone ?? "",
      notes: doctor.notes ?? "",
    };
  }
  return {
    name: "",
    hospitalId: null,
    department: "",
    title: "",
    specialty: "",
    phone: "",
    notes: "",
  };
}

function DoctorForm({
  doctor,
  hospitals,
  onClose,
  onSuccess,
}: {
  doctor: Doctor | null | undefined;
  hospitals: Hospital[];
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!doctor;
  const [formData, setFormData] = useState<DoctorFormData>(() =>
    createFormData(doctor)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = <K extends keyof DoctorFormData>(
    field: K,
    value: DoctorFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.hospitalId) {
      setError("请选择所属医院");
      return;
    }

    if (!formData.department.trim()) {
      setError("请填写科室");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/doctors/${doctor.id}` : "/api/doctors";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          hospitalId: formData.hospitalId,
          department: formData.department,
          title: formData.title || null,
          specialty: formData.specialty || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "保存失败");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? "编辑医生" : "添加医生"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改医生信息" : "添加新的医生"}
        </SheetDescription>
      </SheetHeader>

      <form
        onSubmit={onSubmit}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">医生姓名</Label>
            <Input
              id="name"
              placeholder="例如：张医生"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hospitalId">所属医院</Label>
            <Select
              value={formData.hospitalId?.toString() ?? ""}
              onValueChange={(value) => handleChange("hospitalId", parseInt(value, 10))}
            >
              <SelectTrigger id="hospitalId">
                <SelectValue placeholder="选择医院" />
              </SelectTrigger>
              <SelectContent>
                {hospitals.map((hospital) => (
                  <SelectItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">科室</Label>
            <Input
              id="department"
              placeholder="例如：儿科、内科、外科"
              value={formData.department}
              onChange={(e) => handleChange("department", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">职称</Label>
            <Select
              value={formData.title}
              onValueChange={(value) => handleChange("title", value)}
            >
              <SelectTrigger id="title">
                <SelectValue placeholder="选择职称" />
              </SelectTrigger>
              <SelectContent>
                {DOCTOR_TITLES.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">专长</Label>
            <Input
              id="specialty"
              placeholder="例如：儿童呼吸系统疾病"
              value={formData.specialty}
              onChange={(e) => handleChange("specialty", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">电话</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="例如：138-0000-0000"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="其他需要记录的信息"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-widget bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : isEditing ? "保存修改" : "添加"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function DoctorSheet({
  open,
  onOpenChange,
  doctor,
  hospitals,
  onSuccess,
}: DoctorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <DoctorForm
          key={open ? (doctor?.id ?? "new") : "closed"}
          doctor={doctor}
          hospitals={hospitals}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}
