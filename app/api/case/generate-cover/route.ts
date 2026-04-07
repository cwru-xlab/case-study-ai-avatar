import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { s3Storage } from "@/lib/s3-client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { caseId, name, backgroundInfo } = await request.json();

    if (!caseId) {
      return NextResponse.json(
        { error: "Case ID is required" },
        { status: 400 }
      );
    }

    if (!name && !backgroundInfo) {
      return NextResponse.json(
        { error: "Case name or background info is required" },
        { status: 400 }
      );
    }

    // Create a prompt for DALL-E based on the case content
    const prompt = `Professional business illustration for a case study titled "${name}". ${backgroundInfo ? `Context: ${backgroundInfo.substring(0, 200)}` : ""} Style: Modern, clean, corporate, abstract representation suitable for educational content. No text or words in the image. Soft gradients, professional color palette.`;

    // Generate image with DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI");
    }

    // Download the image and upload to S3
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBlob = new Blob([imageBuffer], { type: "image/png" });
    const imageFile = new File([imageBlob], `${caseId}-cover.png`, { type: "image/png" });

    // Delete any existing cover image
    try {
      await s3Storage.deleteCaseCoverImage(caseId);
    } catch (error) {
      console.warn("Failed to delete existing cover image:", error);
    }

    // Upload to S3
    const publicUrl = await s3Storage.uploadCaseCoverImage(caseId, imageFile);

    return NextResponse.json({
      success: true,
      caseId,
      url: publicUrl,
      message: "Cover image generated successfully",
    });
  } catch (error) {
    console.error("AI cover image generation error:", error);

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }
      if (error.message.includes("billing") || error.message.includes("quota") || error.message.includes("Billing hard limit")) {
        return NextResponse.json(
          { error: "OpenAI billing limit reached. Please check your OpenAI account or upload an image manually." },
          { status: 500 }
        );
      }
      if (error.message.includes("content_policy")) {
        return NextResponse.json(
          { error: "Content policy violation. Please modify the case description." },
          { status: 400 }
        );
      }
    }

    // Check for billing error in error object
    const errorObj = error as { code?: string };
    if (errorObj.code === "billing_hard_limit_reached") {
      return NextResponse.json(
        { error: "OpenAI billing limit reached. Please check your OpenAI account or upload an image manually." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate cover image" },
      { status: 500 }
    );
  }
}
