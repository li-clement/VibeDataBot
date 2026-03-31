import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        // 如果未指定 dir，则以系统家目录为起点
        const targetDir = searchParams.get("dir") || os.homedir();

        // 防止目录遍历攻击跳出指定限制（虽然在本地环境相对安全，但加上较好）
        const resolvedPath = path.resolve(targetDir);

        if (!fs.existsSync(resolvedPath)) {
            return NextResponse.json({ error: true, message: `Directory not found: ${resolvedPath}` }, { status: 404 });
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isDirectory()) {
            return NextResponse.json({ error: true, message: `Path is not a directory: ${resolvedPath}` }, { status: 400 });
        }

        // 读取目录内容
        const items = fs.readdirSync(resolvedPath, { withFileTypes: true });

        // 整理返回值（过滤掉前缀是 . 的隐藏文件或特定的系统废弃目录，提升观感）
        const result = items
            .filter((item) => !item.name.startsWith("."))
            .map((item) => {
                const itemPath = path.join(resolvedPath, item.name);
                return {
                    name: item.name,
                    path: itemPath,
                    isDirectory: item.isDirectory(),
                };
            });

        // 排序规则：文件夹在前，文件在后，同类按字母排序
        result.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });

        return NextResponse.json({ path: resolvedPath, items: result }, { status: 200 });

    } catch (e: any) {
        console.error("Failed to read directory:", e);
        return NextResponse.json({ error: true, message: e.message }, { status: 500 });
    }
}
