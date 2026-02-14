"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Home, Car, FileText } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssetSheet } from "./asset-sheet";

type AssetType = "RealEstate" | "Vehicle";

interface Asset {
  id: number;
  type: AssetType;
  name: string;
  identifier: string;
  ownerId: number | null;
  ownerName: string | null;
  details: string | null;
  policyCount: number;
}

const typeLabels: Record<AssetType, string> = {
  RealEstate: "不动产",
  Vehicle: "车辆",
};

const typeIcons: Record<AssetType, typeof Home> = {
  RealEstate: Home,
  Vehicle: Car,
};

const typeBadgeColors: Record<AssetType, string> = {
  RealEstate: "bg-blue-500/10 text-blue-500",
  Vehicle: "bg-green-500/10 text-green-500",
};

const typeIconBgColors: Record<AssetType, string> = {
  RealEstate: "bg-blue-100 dark:bg-blue-900",
  Vehicle: "bg-green-100 dark:bg-green-900",
};

const typeIconColors: Record<AssetType, string> = {
  RealEstate: "text-blue-600 dark:text-blue-400",
  Vehicle: "text-green-600 dark:text-green-400",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const fetchAssets = () => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data: Asset[]) => {
        setAssets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAdd = () => {
    setEditingAsset(null);
    setSheetOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setSheetOpen(true);
  };

  const handleDeleteClick = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;

    const response = await fetch(`/api/assets/${assetToDelete.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchAssets();
    }
    setDeleteDialogOpen(false);
    setAssetToDelete(null);
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "资产管理" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "资产管理" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">资产管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {assets.length} 项资产
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加资产
          </Button>
        </div>

        <div className="rounded-card bg-secondary">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>标识/产权号</TableHead>
                <TableHead>所有人</TableHead>
                <TableHead className="text-center">保单数</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      暂无资产，点击「添加资产」开始记录
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => {
                  const Icon = typeIcons[asset.type];
                  const hasPolicies = asset.policyCount > 0;
                  return (
                    <TableRow key={asset.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeIconBgColors[asset.type]}`}>
                            <Icon className={`h-4 w-4 ${typeIconColors[asset.type]}`} />
                          </div>
                          <span className="font-medium">{asset.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeBadgeColors[asset.type]}>{typeLabels[asset.type]}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {asset.identifier}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.ownerName ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasPolicies ? (
                          <div className="flex items-center justify-center gap-1">
                            <FileText className="h-3 w-3 text-primary" />
                            <span className="text-sm">{asset.policyCount}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(asset)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">编辑</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={hasPolicies}
                            onClick={() => handleDeleteClick(asset)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">删除</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AssetSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        asset={editingAsset}
        onSuccess={fetchAssets}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除资产「{assetToDelete?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
