import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
        return NextResponse.json({ error: "Missing 'path' parameter" }, { status: 400 });
    }

    // Sanitize pseudo protocols often attached by Ray or FileTrees
    let cleanPath = filePath;
    if (cleanPath.startsWith("local:")) cleanPath = cleanPath.replace("local:", "");
    if (cleanPath.startsWith("file://")) cleanPath = cleanPath.replace("file://", "");

    try {
        const resolvedPath = path.resolve(cleanPath);

        // Security check: ensure the file exists and is a file
        const stat = await fs.promises.stat(resolvedPath);
        if (!stat.isFile()) {
            return NextResponse.json({ error: "Provided path is not a valid file" }, { status: 400 });
        }

        // Extremely basic content type mapping (Expandable for images later if needed)
        let contentType = "application/octet-stream";
        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext === ".pdf") contentType = "application/pdf";
        else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".png") contentType = "image/png";

        // Read the file as a buffer to send as response body
        // Note: For very large files in Next.js App Router, using Streams is preferred
        // but for PDF previewing (usually < 20MB) a direct buffer is often reliable enough
        const fileBuffer = await fs.promises.readFile(resolvedPath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": stat.size.toString(),
                // Tell browser to display inline (don't force a download dialog)
                "Content-Disposition": `inline; filename="${path.basename(resolvedPath)}"`,
            },
        });
    } catch (error: any) {
        console.error("Local File Proxy Error:", error);
        return NextResponse.json(
            { error: "Failed to read file", details: error.message },
            { status: 500 }
        );
    }
}
