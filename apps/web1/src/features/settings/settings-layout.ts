// Presentation inventory from the read-only E42 drawing. Values/options are supplied by native consumers.
export const settingsLayout = [
  {
    key: "genel",
    cards: [
      {
        key: "ay-genel",
        fields: [
          {
            key: "ay-ad",
            kind: "text",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-sube",
            kind: "text",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-tel",
            kind: "text",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-posta",
            kind: "email",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-adres",
            kind: "text",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-tz",
            kind: "text",
            readonly: true,
            disabled: false,
          },
          {
            key: "ay-program-sure",
            kind: "number",
            readonly: false,
            disabled: false,
          },
        ],
      },
      {
        key: "ay-marka",
        fields: [],
      },
    ],
  },
  {
    key: "kurallar",
    cards: [
      {
        key: "ay-kural",
        fields: [
          {
            key: "ay-acilis",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-iptal",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-yoklama",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-teklif",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-bekleme",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-gec",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-gelmedi",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
        ],
      },
    ],
  },
  {
    key: "politika",
    cards: [
      {
        key: "politika-0",
        fields: [],
      },
    ],
  },
  {
    key: "salonlar",
    cards: [
      {
        key: "ay-salon",
        fields: [],
      },
    ],
  },
  {
    key: "bildirim",
    cards: [
      {
        key: "bildirim-0",
        fields: [
          {
            key: "ay-n-0",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-n-1",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-n-2",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-n-3",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-n-4",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
        ],
      },
      {
        key: "ay-hat",
        fields: [
          {
            key: "ay-h-ders-n",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-ders",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-paket-n",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-paket",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-vade-n",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-vade",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-etkinlik-n",
            kind: "select",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-h-etkinlik",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-c-mail",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-c-app",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-c-sms",
            kind: "switch",
            readonly: false,
            disabled: true,
          },
          {
            key: "ay-c-wa",
            kind: "switch",
            readonly: false,
            disabled: true,
          },
          {
            key: "ay-q-on",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-q-a",
            kind: "time",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-q-b",
            kind: "time",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-q-tz",
            kind: "text",
            readonly: true,
            disabled: false,
          },
        ],
      },
    ],
  },
  {
    key: "sablon",
    cards: [
      {
        key: "sablon-0",
        fields: [],
      },
    ],
  },
  {
    key: "yayin",
    cards: [
      {
        key: "ay-yayin",
        fields: [
          {
            key: "ay-py-on",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-py-slug",
            kind: "text",
            readonly: true,
            disabled: false,
          },
          {
            key: "ay-py-form",
            kind: "switch",
            readonly: false,
            disabled: false,
          },
          {
            key: "ay-py-cons",
            kind: "text",
            readonly: false,
            disabled: false,
          },
        ],
      },
    ],
  },
  {
    key: "ekip",
    cards: [
      {
        key: "ekip-0",
        fields: [],
      },
      {
        key: "ay-izin",
        fields: [],
      },
    ],
  },
  {
    key: "plan",
    cards: [
      {
        key: "plan-0",
        fields: [],
      },
      {
        key: "plan-1",
        fields: [],
      },
      {
        key: "plan-2",
        fields: [],
      },
    ],
  },
  {
    key: "gecmis",
    cards: [
      {
        key: "gecmis-0",
        fields: [
          {
            key: "hs-f",
            kind: "select",
            readonly: false,
            disabled: false,
          },
        ],
      },
    ],
  },
] as const;
export type SettingsSection = (typeof settingsLayout)[number]["key"];
export type SettingsCardKey = (typeof settingsLayout)[number]["cards"][number]["key"];
export type SettingsFieldKey =
  (typeof settingsLayout)[number]["cards"][number]["fields"][number]["key"];
