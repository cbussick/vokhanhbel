import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CardFormDialog } from "../components/CardFormDialog";
import { cardsQuery } from "../lib/queries";

export const Route = createFileRoute("/cards/$collectionId/$cardId")({
  component: CardDetailRoute,
});

function CardDetailRoute() {
  const navigate = useNavigate();
  const { collectionId, cardId } = Route.useParams();
  const cards = useQuery(cardsQuery);
  const card = cards.data?.find((entry) => entry.id === cardId);

  if (!card) return null;

  const close = () => void navigate({ to: "/cards/$collectionId", params: { collectionId } });

  return <CardFormDialog card={card} onClose={close} onDeleted={close} />;
}
