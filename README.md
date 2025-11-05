# ETC (Equal Task Cycle) 

[![Tests](https://github.com/PhilippePerret/ETC/actions/workflows/tests.yaml/badge.svg)](https://github.com/PhilippePerret/ETC/actions/workflows/tests.yaml)

[![Code Quality](https://github.com/PhilippePerret/ETC/actions/workflows/code-quality.yaml/badge.svg)](https://github.com/PhilippePerret/ETC/actions/workflows/code-quality.yaml)

**ETC** est une application qui permet de travailler un ensemble de tâches en leur alouant un temps afin de les exécuter toutes parallèlement sans en délaisser.

Par exemple, si nous avons 5 tâches, et un temps par défaut de 2 heures, les tâches seront proposées dans le désordre, jusqu'à ce que chacune ait été accomplie pendant au moins 2 heures avant que le cycle ne recommence.

---

## Démarrage rapide

* télécharger le zip de l'application
* la décompresser
* ouvrir un terminal au dossier de l'application
* jouer `bun install`
* jouer `bun run start` pour lancer l'application en mode développement
* jouer `bun run build` pour construire une release

Pour les tests

* jouer `bunx playwright install`
* jouer `bun run tests`

## Essai (mode développement)

Démarrer l’application avec : 

~~~shell
bun run start
~~~

Pour redémarrer l’application en purgeant bien tous les éléments :

~~~shell
bun run reset
~~~

> Pour que cette commande fonctionne, il faut mettre à la racine du dossier un fichier `.secret/password` avec son mot de passe.

Produire une release à l’aide de (après avoir incrémenté la version dans `package.json` :

~~~shell
bun run build
~~~



---

<a name="travail-par-cycle"></a>

## Travail par cycle

L’idée principale de cette application est donc de permettre de travail par cycle, en consacrant un temps de travail dans l’idée identique à toutes les tâches (en gardant la possibilité de fixer une durée de tranche de travail spécifique à chaque tâche, quand c’est nécessaire (et suivant sa philosophie personnelle de travail.

Ce mode par cycle permet de faire avancer plusieurs gros chantiers de front sans en laisser de côté. Il permet aussi, avec le [choix aléatoire des tâches](#random-tasks) de produire des journées de travail toujours différentes.

---

## Trois zones de l’application

L’application/interface est composée de trois parties.

* La [**Zone de travail**](#zone-travail) proprement dite, on la tâche est présentée, où elle sera lancée et le temps comptabilisé.
* La [**Zone de préférences**](#zone-preferences), pour régler les préférences d’interface principalement (et voir les outils utiles).
* La [**Zone d’enregistrement**](#zone-enregistrement). Pour enregistrer les tâches, les modifier ainsi que régler les paramètres généraux et les valeurs par défaut.

<a name="zone-travail"></a>

### La Zone de travail

{Décrire}

<a name="zone-preferences"></a>

### La Zone de préférence

On l’atteint avec le bouton ⚙️.

{Décrire}

<a name="zone-enregistrement"></a>

### La Zone d’enregistrement

On l’atteint avec le bouton ✍🏽.

{Décrire}



---

<a name="random-tasks"></a>

### Choix aléatoire des tâches

Pour produire des journées de travail toujours différentes et casser la routine de travail, ETC peut fonctionner en mode aléatoire au niveau du choix des tâches. Dans ce mode, les tâches seront choisies au hasard.

Pour régler ce mode, rejoindre les préférences (⚙️) et choisir le mode « random ».

## Mode Electron

Pour pouvoir enrouler l’application à l’intérieur d’une application *Electron*, nous avons besoin de mettre son code dans le dossier `./electron`. Il faut donc veiller à être dans le bon dossier lorsqu’on joue une commande.

Voici un petit rappel :

| À la racine DE L’APPLICATION |                                                              | Dans le dossier Electron |
| ---------------------------- | :----------------------------------------------------------: | ------------------------ |
| **`bun run watch_ts`**       | Pour surveiller les fichiers `ts`<br />du dossier `./public` |                          |
|                              |       Pour lancer l’application en mode développement.       | **`bun run start`**      |
|                              |   Pour produire la release<br />(ne fonctionne pas encore)   | **`bun run build`**      |
|                              |                                                              |                          |



## Lancer en mode développement

* rejoindre le dossier `electron/` (**`cd electron/`**)
* jouer la commande **`bun run start`**

Pour lancer un watcher sur les fichiers `public/main.ts` et `public/ui.ts` (et les futurs modules peut-être), jouer (à la racine de l’application) : 

~~~shell
bun run watch_ts
~~~



## Fonctionnement au quotidien

* Mettre dans un fichier `TASKS.yaml`, à l’extérieur de l’application, les tâches courantes, en définissant leur dossier principal ou le script qui doit être joué pour les "lancer".
* Définir le temps par défaut en haut du fichier.
* Lancer ETC au démarrage de l'ordinateur (si possible dans le dossier contenant le fichier des tâches, sinon avec un chemin d’accès complet précisant où il se trouve).

## Aspect du fichier `_TASKS_`.yaml

~~~yaml
---
duration: 120 # nombre de minutes par défaut pour chaque tâche

works:
  - id: pss
    project: "Passé sous Silence"
    content: "Travailler sur le deuxième Tome"
    duration: 180 # Possibilité de mettre un durée propre, pour travail + ou - une tâche
    folder: '/Users/philippeperret/ICARE_EDITIONS/_LIVRES_/Fictions/Passé sous silence'
  - id: dico
    project: "Grand Dictionnaire du Scénario"
    content: "Développer les exemples et l'interface"
    folder: /Users/philippeperret/ICARE_EDITIONS/_LIVRES_/Narration/Dictionnaire
    script: path/to/startud-script
  - id: idml
    project: "IDML-Générateur"
    content: "Poursuivre le développement"
    folder: "/Users/philippeperret/Programmes/IDML-APGenerator"
  - id: pmail
    project: "Perfect-Mail"
    content: "Poursuivre le développement"
    folder: '/Users/philippeperret/Programmes/Perfect-Mail'
  - id: preludes
    project: "Préludes de Bach"
    content: "Poursuivre la com"
    folder: '/Users/philippeperret/ICARE_EDITIONS/_LIVRES_/Musique/Partitions/Recueils/Les plus beaux préludes de Bach'
  - id: oubliettes
    name: "Le Rayon aux oubliettes"
    content: "Poursuivre le livre"
    folder: '/Users/philippeperret/pCloud Drive/Ecriture/Romans/Le Rayon aux oubliettes'


~~~

### Ajout d’une tâche

Pour qu’une tâche devienne « prioritaire » (juste être exécutée avant les autres), quand on n’est pas en mode aléatoire, il faut la mettre le plus au-dessus des autres possible.

#### Détail des paramètres

| Nom           | description                                                  | notes                                                        |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| id            | Identifiant de la tâche                                      | Très important car sert à identifier la tâches/le travail partout dans le programme. |
| project       | Nom du projet auquel appartient la tâche                     | C’est un dossier et il est indispensable car c’est avec lui que l’application peut s’assurer de l’activité sur le travail. |
| content       | Le contenu proprement dit de la tâche, donc ce qu’il faut faire. | Le texte peut être assez long et suffisamment informatif pour bien renseigner sur la tâche. |
| duration      | Optionnellement, la durée de travail par cycle               | Par essence, chaque tâche devrait se voir affecter le même temps de travail. Mais cette donnée permet de donner plus d’importance à certaines tâches. |
| folder        | Dossier du projet                                            | Ce dossier peut être ouvert à l’aide du bouton « Folder » de l’interface. |
| script | Script de démarrage du projet                                | Cette propriété ouvre tous les possibles et manque cruellement à presque tous les gestionnaires de tâches. Elle permet de lancer un script de démarrage (par exemple pour créer automatiquement une nouvelle version d’un fichier, simplement en cliquant sur le bouton « RUN SCRIPT » de l’interface, ou exécuter un processus long et complexe).<br />Il faut penser à rendre le script exécutable en jouant la commande `chmod +x path/to/script`. |
| active        | [Optionnel] true si la tâche est active                      | Par défaut, c’est true, mais permet de désactiver un travail sans le retirer du fichier |
|               |                                                              |                                                              |

​	

### Mode aléatoire

Par défaut, les tâches sont proposées dans un ordre aléatoire (pour épicer les journées). On peut désactiver ce comportement dans les préférences, en décochant la case « ordre aléatoire » (ou similaire).

### Affichage du temps

L’affichage du « chronomètre » peut se faire suivant deux modes, qu’on choisit dans les préférences de l’application (⚙️) :

* Mode Horloge (Clock). Le temps défile à partir de 0 jusqu’à une heure infinie (noter cependant que puisque le travail se fait par [cycle][], même si vous laissez tourner indéfiniment le chronomètre, seul le temps restant à travailler sera ajouté)

## Annexe

En développement, il faut parfois détruire les processus :

~~~shell
sudo pkill -f "bun.*server"
~~~

Pour voir s’il reste un processus sur le port 3002 (réservé à cette application), jouer : 

~~~shell
lsof -i :3002
~~~

Ça donne le numéro du processus qui tourne sur ce port.



[cycle]: #travail-par-cycle
