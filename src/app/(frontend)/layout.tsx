import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Soga healthcare data network dashboard.',
  title: 'Soga | Clinical Command Centre',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
