"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface PaymentProviderSelectorProps {
  onSelect: (provider: "stripe" | "lemonsqueezy") => void
  defaultProvider?: "stripe" | "lemonsqueezy"
}

/**
 * Component that allows selecting between payment providers
 */
export default function PaymentProviderSelector({
  onSelect,
  defaultProvider = "stripe"
}: PaymentProviderSelectorProps) {
  const [provider, setProvider] = useState<"stripe" | "lemonsqueezy">(
    defaultProvider
  )

  // Call the onSelect callback when the provider changes
  useEffect(() => {
    onSelect(provider)
  }, [provider, onSelect])

  return (
    <div className="mb-6 rounded-lg border p-4">
      <h3 className="mb-4 text-lg font-medium">Payment Provider</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Choose your preferred payment processor
      </p>
      <RadioGroup
        defaultValue={provider}
        value={provider}
        onValueChange={value => setProvider(value as "stripe" | "lemonsqueezy")}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div className="hover:bg-accent flex items-center space-x-2 rounded-md border p-4">
          <RadioGroupItem value="stripe" id="stripe" />
          <Label
            htmlFor="stripe"
            className="flex flex-1 cursor-pointer flex-col"
          >
            <span className="font-medium">Stripe</span>
            <span className="text-muted-foreground text-sm">
              Industry standard payment processor with broad global coverage
            </span>
          </Label>
        </div>
        <div className="hover:bg-accent flex items-center space-x-2 rounded-md border p-4">
          <RadioGroupItem value="lemonsqueezy" id="lemonsqueezy" />
          <Label
            htmlFor="lemonsqueezy"
            className="flex flex-1 cursor-pointer flex-col"
          >
            <span className="font-medium">LemonSqueezy</span>
            <span className="text-muted-foreground text-sm">
              Creator-friendly payment processor with simple pricing
            </span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}
