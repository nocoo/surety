"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, Plus, Pencil, Trash2, Home, Car } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

const typeLabels: Record<AssetType, string> = {
  RealEstate: "不动产",
  Vehicle: "车辆",
};

const typeIcons: Record<AssetType, typeof Home> = {
  RealEstate: Home,
  Vehicle: Car,
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

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

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`确定要删除 ${asset.name} 吗？`)) return;

    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchAssets();
    }
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

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>标识/产权号</TableHead>
                <TableHead>所有人</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      暂无资产，点击「添加资产」开始记录
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => {
                  const Icon = typeIcons[asset.type];
                  return (
                    <TableRow key={asset.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{asset.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[asset.type]}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {asset.identifier}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.ownerName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">操作菜单</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(asset)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(asset)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    </AppShell>
  );
}
