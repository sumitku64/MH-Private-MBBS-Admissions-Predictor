// Supporting constants — college data now lives in Supabase (see supabase_migration2.sql)

export const CATEGORIES = [
  { value: 'open',  label: 'Open (UR)'       },
  { value: 'obc',   label: 'OBC / EBC / SEBC' },
  { value: 'sebc',  label: 'SEBC'             },
  { value: 'vjnt',  label: 'VJ / NT (A)'      },
  { value: 'sc',    label: 'SC'               },
  { value: 'st',    label: 'ST'               },
];

export const GENDERS = [
  { value: 'any',    label: 'Any'    },
  { value: 'male',   label: 'Male'   },
  { value: 'female', label: 'Female' },
];

export const MEDICAL_QUOTES = [
  { quote: "To cure sometimes, to relieve often, to comfort always.",                                  author: "Ambroise Paré"       },
  { quote: "The good physician treats the disease; the great physician treats the patient.",           author: "William Osler"       },
  { quote: "Wherever the art of medicine is loved, there is also a love of humanity.",                author: "Hippocrates"         },
  { quote: "Listen to your patient — they are telling you the diagnosis.",                            author: "William Osler"       },
  { quote: "First, do no harm.",                                                                       author: "Hippocratic Oath"    },
  { quote: "Medicine is not only a science; it is also an art.",                                      author: "Paracelsus"          },
  { quote: "In nothing do men more nearly approach the gods than in giving health to men.",            author: "Cicero"              },
  { quote: "The life so short, the craft so long to learn.",                                          author: "Hippocrates"         },
  { quote: "It is more important to know what sort of person has a disease than what disease a person has.", author: "Hippocrates"   },
  { quote: "One of the first duties of the physician is to educate the masses not to take medicine.", author: "William Osler"       },
  { quote: "The best doctor gives the least medicine.",                                               author: "Benjamin Franklin"   },
  { quote: "Wherever you go, go with all your heart — and heal it.",                                  author: "Confucius (adapted)" },
];
