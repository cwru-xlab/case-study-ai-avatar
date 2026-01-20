import { NextRequest, NextResponse } from "next/server";
import { guardrailsStorage, type GuardrailsConfig } from "@/lib/guardrails-storage";

export async function GET(request: NextRequest) {
  try {
    const config = await guardrailsStorage.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching guardrails config:", error);
    return NextResponse.json(
      { error: "Failed to fetch guardrails configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const updates: Partial<GuardrailsConfig> & { updatedBy?: string } = await request.json();
    
    // Extract updatedBy from the request
    const { updatedBy = "Unknown Admin", ...configUpdates } = updates;
    
    // Validate the input
    if (configUpdates.blockedTopics && !Array.isArray(configUpdates.blockedTopics)) {
      return NextResponse.json(
        { error: "blockedTopics must be an array" },
        { status: 400 }
      );
    }
    
    if (configUpdates.mentalHealthTopics && !Array.isArray(configUpdates.mentalHealthTopics)) {
      return NextResponse.json(
        { error: "mentalHealthTopics must be an array" },
        { status: 400 }
      );
    }
    
    if (configUpdates.blockedResponses && !Array.isArray(configUpdates.blockedResponses)) {
      return NextResponse.json(
        { error: "blockedResponses must be an array" },
        { status: 400 }
      );
    }

    // Update the configuration
    const updatedConfig = await guardrailsStorage.updateConfig(configUpdates, updatedBy);
    
    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    console.error("Error updating guardrails config:", error);
    return NextResponse.json(
      { error: "Failed to update guardrails configuration" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { updatedBy = "Unknown Admin" } = await request.json();
    
    const defaultConfig = await guardrailsStorage.resetToDefaults(updatedBy);
    
    return NextResponse.json({
      success: true,
      message: "Guardrails configuration reset to defaults",
      config: defaultConfig,
    });
  } catch (error) {
    console.error("Error resetting guardrails config:", error);
    return NextResponse.json(
      { error: "Failed to reset guardrails configuration" },
      { status: 500 }
    );
  }
}