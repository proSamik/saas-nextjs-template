/*
<ai_context>
This server page displays pricing options for the product, integrating Stripe and LemonSqueezy payment links.
</ai_context>
*/

"use server"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import PaymentProviderSelector from "@/components/payment-provider-selector"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createCheckoutSession } from "@/lib/lemonsqueezy"

export default async function PricingPage() {
  const { userId } = await auth()
  const user = await currentUser()
  const userEmail = user?.emailAddresses[0]?.emailAddress

  return (
    <div className="container mx-auto py-12">
      <h1 className="mb-8 text-center text-3xl font-bold">Choose Your Plan</h1>
      <PaymentClientWrapper userId={userId} userEmail={userEmail} />
    </div>
  )
}

// Client-side wrapper component to handle state
"use client"
import { useState } from "react"

interface PaymentClientWrapperProps {
  userId: string | null
  userEmail?: string | null
}

function PaymentClientWrapper({ userId, userEmail }: PaymentClientWrapperProps) {
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "lemonsqueezy">("stripe")
  const [isLoading, setIsLoading] = useState(false)

  const getPaymentLinks = (provider: "stripe" | "lemonsqueezy") => {
    if (provider === "stripe") {
      return {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY || "#",
        yearly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY || "#"
      }
    } else {
      return {
        monthly: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_MONTHLY || "#",
        yearly: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_YEARLY || "#"
      }
    }
  }

  const handleCheckout = async (variantId: string) => {
    if (!userId) {
      // Handle not logged in state
      return
    }

    setIsLoading(true)
    try {
      if (paymentProvider === "lemonsqueezy") {
        const { checkoutUrl } = await createCheckoutSession({
          variantId,
          email: userEmail || undefined,
          userId,
          successUrl: `${window.location.origin}/dashboard?success=true`,
          cancelUrl: `${window.location.origin}/pricing?cancelled=true`
        })
        window.location.href = checkoutUrl
      } else {
        // Handle Stripe checkout
        const stripeLinks = getPaymentLinks("stripe")
        window.location.href = variantId === process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY
          ? stripeLinks.monthly
          : stripeLinks.yearly
      }
    } catch (error) {
      console.error("Error creating checkout:", error)
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PaymentProviderSelector 
        onSelect={setPaymentProvider}
        defaultProvider="stripe"
      />
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <PricingCard
          title="Monthly Plan"
          price="$10"
          description="Billed monthly"
          buttonText={`Subscribe Monthly with ${paymentProvider === "stripe" ? "Stripe" : "LemonSqueezy"}`}
          variantId={process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY || ""}
          onClick={() => handleCheckout(process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY || "")}
          isLoading={isLoading}
        />
        <PricingCard
          title="Yearly Plan"
          price="$100"
          description="Billed annually"
          buttonText={`Subscribe Yearly with ${paymentProvider === "stripe" ? "Stripe" : "LemonSqueezy"}`}
          variantId={process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY || ""}
          onClick={() => handleCheckout(process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY || "")}
          isLoading={isLoading}
        />
      </div>
    </>
  )
}

interface PricingCardProps {
  title: string
  price: string
  description: string
  buttonText: string
  variantId: string
  onClick: () => void
  isLoading: boolean
}

function PricingCard({
  title,
  price,
  description,
  buttonText,
  onClick,
  isLoading
}: PricingCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex grow items-center justify-center">
        <p className="text-4xl font-bold">{price}</p>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onClick}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : buttonText}
        </Button>
      </CardFooter>
    </Card>
  )
}
