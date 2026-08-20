# Use react-i18next for UI Translation

V1's UI is German, but hardcoded copy would make a later UI locale expensive to introduce. We route all user-facing copy through `react-i18next` and ship only the fixed `de` locale in V1, while keeping Card content free-form and using German as the Tutor's explanation language.
