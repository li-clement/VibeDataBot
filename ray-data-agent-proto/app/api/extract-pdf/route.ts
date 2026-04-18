import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { filePath } = body;

        if (!filePath) {
            return NextResponse.json(
                { error: true, message: "No filePath provided for extraction." },
                { status: 400 }
            );
        }

        // Setup paths appropriately considering the root is ray-data-agent-proto
        // Use python path from the local venv if available, or just fallback to 'python3'
        // For current setup, we assume python3 is accessible and libraries are installed
        const rootDir = process.cwd();
        const pythonCommand =
            process.env.PYTHON_BIN ||
            (process.env.VIRTUAL_ENV ? path.join(process.env.VIRTUAL_ENV, "bin/python") : "python");
        
        // Use cli.py
        const cliScript = path.join(rootDir, "features/pdf_extractor/logic/cli.py");

        console.log(`[API] Executing: ${pythonCommand} ${cliScript} --file_path "${filePath}"`);
        
        // Important: specify standard MAX_BUFFER or handle big outputs
        // PDF markdown might be long, let's bump the buffer to 10MB
        const { stdout, stderr } = await execAsync(
            `${pythonCommand} ${cliScript} --file_path "${filePath}"`, 
            {
                cwd: rootDir,
                env: { ...process.env, PYTHONPATH: rootDir }, 
                maxBuffer: 1024 * 1024 * 10 
            }
        );

        if (stderr && !stdout) {
            console.error("[API] python stderr:", stderr);
        }

        // Parse JSON output exactly as stdout printed
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
             return NextResponse.json(result, { status: 500 });
        }

        return NextResponse.json(result, { status: 200 });

    } catch (error: unknown) {
        console.error("Failed to run PDF extraction API:", error);
        return NextResponse.json(
            { error: true, message: getErrorMessage(error) || "Unknown execution error" },
            { status: 500 }
        );
    }
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
