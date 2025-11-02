# Manuel de développement



## Réflexion

### Réflexion sur le cron

**Question** : Comment peut-on savoir que le cron est à lancer ?

**Réflexion concrète** (car je n’arrive pas à bien le réveiller. Prenons un cas concret :

Nous sommes le 12 avril, un travail a un cron qui doit l’activer le 25 décembre (2025). Si je prends la précédente date d’échéance (25 décembre 2024), je ne trouve pas de cronedAt donc je vais l’activer. Je pourrais vérifier avec la date de création du travail mais cette information n’existe pas ? DONC JE SUIS COINCÉ :

Solutions :

1) j’enregistre la date de création du travail et je m’assure que la date précédente était après la création du travail => il demande à être activé. Il la faut de toute façon => la créer
2) Ou plus simple, j’ajoute une colonne « next_cron_headline » qui contient toujours la prochaine date d’activation. Si elle est dépassée (et qu’il n’y a  pas eu de cronedAt) => on la réveille

**Réponse** : quand 1) le travail n’est pas actif, 2) la prochaine échéance est passée 2) la date d’enregistrement du dernier cron est supérieure à l’échéance précédente et 3) la date d’enregistrement du dernier cron (`cronedAt`) est inférieure à la prochaine date.

Ou plutôt : 1) le travail est inactif, 2) on a passé la dernière date de déclenchement et 3) aucun cronedAt n’a été enregistré après cette date de déclenchement (ce qui sous-entend que le dernier déclenchement n’a pas pu être activé, certainement parce que l’application n’était pas en service à ce moment (c’est ça, en fait, qui pose problème dans l’algorithme.

Dès que le travail est fini, s’il a un cron, il faut enregistrer la date de dernier enregistrement du cronAt.

### Réflexion sur le script

**Question** : Comment lancer un script dans une fenêtre Terminal. Cette question doit être abordée dans le manuel d’utilisation (ajouter un « (?) » dans l’éditing des travaux).

**Exemple** : Par exemple, j’ai mis le script `iced`, mais il se lance, en développement, dans la console de lancement de ETC, sans interactivité.

**Solution :** Normalement, il faudrait passer par AppleScript mais je voudrais absolument m’en passer.

## Blocages

En cas de blocage du port, jouer : 

~~~shell
pkill -f bun
pkill -f electron
~~~

… pour tuer tous les processus. Mais attention : ça tue vraiment tous les processus. Si d’autres applications identiques sont en route, elles seront aussi arrêtées. Peut-être passer plutôt par le monitor d’activité.

On peut jouer aussi : 

~~~shell
bun run reset
bun run force-vide-cache-macos
~~~







## Temps

Explication des temps dans la base de données et le programme.

| Nom               | Persistance | Description                                                  |
| ----------------- | ----------- | ------------------------------------------------------------ |
| **`cycleTime`**   | Oui         | Définit la durée de travail qu’il faut avoir effectué pour considérer que le travail a couvert un cycle. Parfois, ça peut se faire en plusieurs sessions (grâce à `sessionTime`). |
| **`sessionTime`** | Oui         | Détermine la durée que doit avoir une session de travail pour le travail donné. Souvent, cette durée sera égale à la durée pour un cycle de travail. Mais lorsqu’elle est inférieure (elle ne peut être qu’inférieur, sinon le travail ne serait jamais fini).<br />Noter que quelle que soit le temps vraiment fait sur une session, à la session suivante, la même durée sera proposée. C’est donc vraiment une propriété de travail. |
| **`leftTime`**    | Oui         | Durée restante pour que le cycle soit complet pour le travail. |
| **`totalTime`**   | Oui         | Durée totale de travail sur le projet, tous cycles confondus. |
| **`workedTime`**  | Non         | Durée déjà effectuée dans le cycle courant. On a donc `workedTime + leftTime = cycleTime`. |

## Locales

Pour checker les locales, c’est-à-dire voir celles qui sont à ajouter, lancer : 

~~~shell
bun run check-locales
~~~

### Ajouter une langue

Pour ajouter une langue, dupliquer un dossier de `lib/locales/, le renommer avec les deux lettres de la langue, puis corriger tous les textes.
