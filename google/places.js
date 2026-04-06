const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.addressComponents",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

function getApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY in environment.");
  }

  return apiKey;
}

async function parseError(response) {
  const body = await response.text();
  return `Google Places API error ${response.status}: ${body}`;
}

export async function searchTextPlaces({
  textQuery,
  pageSize = 20,
  pageToken,
  languageCode = "en",
}) {
  const apiKey = getApiKey();

  const response = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DEFAULT_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      pageSize,
      pageToken,
      languageCode,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function searchAllPlaces({
  textQuery,
  maxResults = 20,
  languageCode = "en",
}) {
  const places = [];
  let nextPageToken;

  while (places.length < maxResults) {
    const remaining = maxResults - places.length;
    const response = await searchTextPlaces({
      textQuery,
      pageSize: Math.min(20, remaining),
      pageToken: nextPageToken,
      languageCode,
    });

    places.push(...(response.places ?? []));

    if (!response.nextPageToken || response.places?.length === 0) {
      break;
    }

    nextPageToken = response.nextPageToken;
  }

  return places.slice(0, maxResults);
}

function findAddressComponent(addressComponents = [], type) {
  return addressComponents.find((component) => component.types?.includes(type));
}

export function mapPlaceToBusiness(place) {
  const city =
    findAddressComponent(place.addressComponents, "locality")?.longText
    ?? findAddressComponent(place.addressComponents, "postal_town")?.longText
    ?? findAddressComponent(place.addressComponents, "administrative_area_level_2")?.longText
    ?? null;

  return {
    placeId: place.id,
    name: place.displayName?.text ?? "",
    category: place.primaryTypeDisplayName?.text ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    address: place.formattedAddress ?? null,
    city,
    state: findAddressComponent(place.addressComponents, "administrative_area_level_1")?.longText ?? null,
    country: findAddressComponent(place.addressComponents, "country")?.longText ?? null,
    rating: place.rating ?? null,
    mapsUrl: place.googleMapsUri ?? null,
  };
}
