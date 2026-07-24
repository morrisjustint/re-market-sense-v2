import type { Metadata } from "next"

import { ListsPageClient } from "@/components/lists/lists-page-client"
import { getLists } from "@/lib/data"

export const metadata: Metadata = {
  title: "Lists",
}

export default async function ListsPage() {
  const lists = await getLists()
  return <ListsPageClient lists={lists} />
}
