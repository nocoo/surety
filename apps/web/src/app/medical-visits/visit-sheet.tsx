
import { useState, useMemo, useCallback, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const VISIT_TYPES = ["门诊", "急诊", "体检", "复查", "预约", "儿保"];

// Tag input component for symptoms
function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
  }, [value, onChange]);

  const removeTag = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "、") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  }, [inputValue, value.length, addTag, removeTag]);

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  }, [inputValue, addTag]);

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border hover:border-foreground/20 bg-secondary px-3 py-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((tag, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">删除 {tag}</span>
          </button>
        </Badge>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : "继续输入..."}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

interface Member {
  id: number;
  name: string;
}

interface Hospital {
  id: number;
  name: string;
}

interface Doctor {
  id: number;
  name: string;
  hospitalId: number;
}

interface VisitFormData {
  memberId: number | null;
  hospitalId: number | null;
  doctorId: number | null;
  visitDate: string;
  visitTimeStart: string;
  visitTimeEnd: string;
  visitType: string;
  visitReason: string;
  department: string;
  symptoms: string[];  // Array of symptom strings
  diagnosis: string;
  treatment: string;
  totalCost: string;
  insurancePaid: string;
  selfPaid: string;
  notes: string;
}

interface MedicalVisit {
  id: number;
  memberId: number;
  hospitalId: number;
  doctorId: number | null;
  visitDate: string;
  visitTimeStart?: string | null | undefined;
  visitTimeEnd?: string | null | undefined;
  visitType: string;
  visitReason: string;
  department: string | null;
  symptoms?: string | null | undefined;
  diagnosis: string | null;
  treatment: string | null;
  totalCost: number | null;
  insurancePaid: number | null;
  selfPaid: number | null;
  notes: string | null;
}

interface VisitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit?: MedicalVisit | null;
  members: Member[];
  hospitals: Hospital[];
  doctors: Doctor[];
  onSuccess?: () => void;
}

function getTodayDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function parseSymptomsJson(symptoms: string | null | undefined): string[] {
  if (!symptoms) return [];
  try {
    const parsed = JSON.parse(symptoms);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === "string" && s.length > 0);
    }
  } catch {
    // Not JSON, try splitting for legacy data
  }
  // Fallback: split by delimiters
  return symptoms
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function createFormData(visit: MedicalVisit | null | undefined): VisitFormData {
  if (visit) {
    return {
      memberId: visit.memberId,
      hospitalId: visit.hospitalId,
      doctorId: visit.doctorId,
      visitDate: visit.visitDate,
      visitTimeStart: visit.visitTimeStart ?? "",
      visitTimeEnd: visit.visitTimeEnd ?? "",
      visitType: visit.visitType,
      visitReason: visit.visitReason,
      department: visit.department ?? "",
      symptoms: parseSymptomsJson(visit.symptoms),
      diagnosis: visit.diagnosis ?? "",
      treatment: visit.treatment ?? "",
      totalCost: visit.totalCost?.toString() ?? "",
      insurancePaid: visit.insurancePaid?.toString() ?? "",
      selfPaid: visit.selfPaid?.toString() ?? "",
      notes: visit.notes ?? "",
    };
  }
  return {
    memberId: null,
    hospitalId: null,
    doctorId: null,
    visitDate: getTodayDate(),
    visitTimeStart: "",
    visitTimeEnd: "",
    visitType: "门诊",
    visitReason: "",
    department: "",
    symptoms: [],
    diagnosis: "",
    treatment: "",
    totalCost: "",
    insurancePaid: "",
    selfPaid: "",
    notes: "",
  };
}

function VisitForm({
  visit,
  members,
  hospitals,
  doctors,
  onClose,
  onSuccess,
}: {
  visit: MedicalVisit | null | undefined;
  members: Member[];
  hospitals: Hospital[];
  doctors: Doctor[];
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!visit;
  const [formData, setFormData] = useState<VisitFormData>(() =>
    createFormData(visit)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter doctors by selected hospital
  const filteredDoctors = useMemo(() => {
    if (!formData.hospitalId) return [];
    return doctors.filter((d) => d.hospitalId === formData.hospitalId);
  }, [doctors, formData.hospitalId]);

  // Check cost consistency
  const costMismatch = useMemo(() => {
    const total = formData.totalCost ? parseFloat(formData.totalCost) : null;
    const insurance = formData.insurancePaid ? parseFloat(formData.insurancePaid) : null;
    const self = formData.selfPaid ? parseFloat(formData.selfPaid) : null;

    // Only check if all three values are provided
    if (total === null || insurance === null || self === null) return null;
    if (isNaN(total) || isNaN(insurance) || isNaN(self)) return null;

    const sum = insurance + self;
    const diff = Math.abs(total - sum);
    // Allow small floating point tolerance
    if (diff < 0.01) return null;
    return { total, sum, diff };
  }, [formData.totalCost, formData.insurancePaid, formData.selfPaid]);

  const handleChange = <K extends keyof VisitFormData>(
    field: K,
    value: VisitFormData[K]
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      // Clear doctor selection when hospital changes
      if (field === "hospitalId") {
        newData.doctorId = null;
      }
      return newData;
    });
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.memberId) {
      setError("请选择就诊人");
      return;
    }
    if (!formData.hospitalId) {
      setError("请选择医院");
      return;
    }
    if (!formData.visitReason.trim()) {
      setError("请填写就诊原因");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/medical-visits/${visit.id}` : "/api/medical-visits";
      const method = isEditing ? "PUT" : "POST";

      const totalCost = formData.totalCost ? parseFloat(formData.totalCost) : null;
      const insurancePaid = formData.insurancePaid ? parseFloat(formData.insurancePaid) : null;
      const selfPaid = formData.selfPaid ? parseFloat(formData.selfPaid) : null;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: formData.memberId,
          hospitalId: formData.hospitalId,
          doctorId: formData.doctorId,
          visitDate: formData.visitDate,
          visitTimeStart: formData.visitTimeStart || null,
          visitTimeEnd: formData.visitTimeEnd || null,
          visitType: formData.visitType,
          visitReason: formData.visitReason,
          department: formData.department || null,
          symptoms: formData.symptoms.length > 0 ? JSON.stringify(formData.symptoms) : null,
          diagnosis: formData.diagnosis || null,
          treatment: formData.treatment || null,
          totalCost,
          insurancePaid,
          selfPaid,
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
        <SheetTitle>{isEditing ? "编辑就诊记录" : "添加就诊记录"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改就诊记录信息" : "添加新的就诊记录"}
        </SheetDescription>
      </SheetHeader>

      <form
        onSubmit={onSubmit}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">就诊人</Label>
              <Select
                value={formData.memberId?.toString() ?? ""}
                onValueChange={(value) => handleChange("memberId", parseInt(value, 10))}
              >
                <SelectTrigger id="memberId">
                  <SelectValue placeholder="选择成员" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitType">就诊类型</Label>
              <Select
                value={formData.visitType}
                onValueChange={(value) => handleChange("visitType", value)}
              >
                <SelectTrigger id="visitType">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitDate">就诊日期</Label>
            <Input
              id="visitDate"
              type="date"
              value={formData.visitDate}
              onChange={(e) => handleChange("visitDate", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="visitTimeStart">开始时间</Label>
              <Input
                id="visitTimeStart"
                type="time"
                value={formData.visitTimeStart}
                onChange={(e) => handleChange("visitTimeStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitTimeEnd">结束时间</Label>
              <Input
                id="visitTimeEnd"
                type="time"
                value={formData.visitTimeEnd}
                onChange={(e) => handleChange("visitTimeEnd", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitReason">就诊原因</Label>
            <Input
              id="visitReason"
              placeholder="例如：发烧、咳嗽、常规体检"
              value={formData.visitReason}
              onChange={(e) => handleChange("visitReason", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hospitalId">医院</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doctorId">医生（可选）</Label>
              <Select
                value={formData.doctorId?.toString() ?? "none"}
                onValueChange={(value) => handleChange("doctorId", value === "none" ? null : parseInt(value, 10))}
                disabled={!formData.hospitalId || filteredDoctors.length === 0}
              >
                <SelectTrigger id="doctorId">
                  <SelectValue placeholder={!formData.hospitalId ? "请先选择医院" : "选择医生"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择</SelectItem>
                  {filteredDoctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id.toString()}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">科室</Label>
              <Input
                id="department"
                placeholder="例如：儿科"
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptoms">症状</Label>
            <TagInput
              value={formData.symptoms}
              onChange={(tags) => handleChange("symptoms", tags)}
              placeholder="输入症状后按回车，如：发烧、咳嗽"
            />
            <p className="text-xs text-muted-foreground">
              输入后按回车或逗号添加，按 Backspace 删除
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">诊断</Label>
            <Textarea
              id="diagnosis"
              placeholder="诊断结果"
              value={formData.diagnosis}
              onChange={(e) => handleChange("diagnosis", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="totalCost">总费用</Label>
              <Input
                id="totalCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.totalCost}
                onChange={(e) => handleChange("totalCost", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurancePaid">医保支付</Label>
              <Input
                id="insurancePaid"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.insurancePaid}
                onChange={(e) => handleChange("insurancePaid", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selfPaid">自付</Label>
              <Input
                id="selfPaid"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.selfPaid}
                onChange={(e) => handleChange("selfPaid", e.target.value)}
              />
            </div>
          </div>

          {costMismatch && (
            <div className="rounded-widget bg-warning/10 border border-warning/30 px-3 py-2 text-sm text-warning">
              费用不一致：医保({costMismatch.sum.toFixed(2)}) ≠ 总费用({costMismatch.total.toFixed(2)})，差额 {costMismatch.diff.toFixed(2)} 元
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="treatment">治疗方案</Label>
            <Textarea
              id="treatment"
              placeholder="处方、用药或治疗方案"
              value={formData.treatment}
              onChange={(e) => handleChange("treatment", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="其他需要记录的信息"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={2}
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

export function VisitSheet({
  open,
  onOpenChange,
  visit,
  members,
  hospitals,
  doctors,
  onSuccess,
}: VisitSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <VisitForm
          key={open ? (visit?.id ?? "new") : "closed"}
          visit={visit}
          members={members}
          hospitals={hospitals}
          doctors={doctors}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}
