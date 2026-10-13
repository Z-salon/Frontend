import { BrandTheme } from '../components/BrandTheme'
import { LinkButton, MessageScreen } from '../components/ui'
import { IconArrowRight } from '../components/icons'

export function NotFound() {
  return (
    <BrandTheme branding={null}>
      <MessageScreen
        tone="info"
        eyebrow="404"
        title="This page took a wrong turn"
        body="The link you followed does not match any salon page. Check the address you were sent, or head back to the storefront."
        actions={
          <>
            <LinkButton to="/" iconRight={<IconArrowRight className="h-4 w-4" />}>
              Go to the storefront
            </LinkButton>
          </>
        }
      />
    </BrandTheme>
  )
}
