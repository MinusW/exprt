# Programmation Concurrente (PCO)
**Haute École d'Ingénierie et de Gestion du Canton de Vaud (HEIG-VD)**  
**Semestre d'automne 2023-2024**  
**Contrôle continu 1**  
**Date :** 13.11.2023  
**Professeur :** Yann Thoma  

---

**Prénom :** ______________________  
**Nom :** _________________________  

### Consignes
* Aucune documentation n'est permise, y compris la feuille de vos voisins.
* La calculatrice n'est pas autorisée.
* Aucune réclamation ne sera acceptée en cas d'utilisation du crayon.
* Ne pas utiliser de couleur rouge.

| Question | Points | Score |
| :--- | :---: | :---: |
| **1** | 8 | |
| **2** | 10 | |
| **3** | 6 | |
| **4** | 6 | |
| **5** | 6 | |
| **Total :** | **36** | |

**Note :** ______

---

## Rappel sur les classes Pco

* `PcoSemaphore::PcoSemaphore(n)` : correspond à initialiser le sémaphore à $n$ ($n$ doit être $\ge 0$) ;
* `PcoSemaphore::acquire()` : correspond à $P(\text{sémaphore})$ ;
* `PcoSemaphore::release()` : correspond à $V(\text{sémaphore})$ ;
* `PcoMutex::lock()` : verrouille un mutex ;
* `PcoMutex::unlock()` : déverrouille un mutex ;
* `PcoThread()` : Constructeur, lance un thread ;
* `PcoThread::join()` : attend qu'un thread se termine.

---

## Question 1 : 8 points

Le code suivant a été écrit par un développeur ne connaissant rien à la concurrence. Votre chef de projet, connaissant votre talent pour la programmation concurrente, vous demande de le rendre sûr, de manière à ce que plusieurs threads interagissent avec un même objet de la classe `AlmostGreat`. Apportez-y donc les modifications nécessaires.

Les fonctions privées ne sont pas détaillées ici, mais les commentaires devraient vous permettre de savoir comment les traiter.

```cpp
class AlmostGreat
{
public:
    double entry1(double a) {
        m_a = a;
        doSomethingWithIt(m_a);
        return someHugeFunction(m_a);
    }

    double entry2(double a, double b) {
        double c = a + b;
        m_a += 2 * c;
        return m_a;
    }

    double entry3(double a, double b) {
        double c = a + b;
        m_a = 2 * c;
        double d = someSimpleFunction(m_a);
        double e = 2 * d;
        return e;
    }

private:
    // This function uses a and modifies it
    void doSomethingWithIt(double &a);

    // This function do some very simple computation
    double someSimpleFunction(double a);

    // This function takes a lot of CPU time (yes, a lot)
    // It is thread-safe
    double someHugeFunction(double a);

    double m_a{0.0};
};
```

---

## Question 2 : 10 points

Les étudiants et le personnel d'enseignement et recherche (PER) du département se retrouvent pour la raclette TIC. Cette année, afin d'éviter les files d'attente interminables, un système de tickets centralisés a été mis en place, les étudiants étant modélisés par des threads. Pour consommer, un étudiant doit appeler la méthode `etudiant()`, qui est bloquante jusqu'à ce qu'un racleur n'appelle `racleur()` et l'embarque sur son stand. Le personnel d'enseignement et recherche, appelle pour sa part, la méthode `per()`, et doit aussi attendre un racleur. Les conditions pour qu'une personne soit relâchée par un racleur sont les suivantes :

Un racleur récupère au maximum 4 personnes. S'il y a un membre PER en attente, alors il embarque un PER et un maximum de trois étudiants. Si aucun membre du PER n'est présent, alors il embarque un maximum de quatre étudiants. La méthode `racleur()` retourne le nombre de personnes qui suivent le racleur.

Écrivez le code de la classe `RacletteTic`, en exploitant des sémaphores (et des variables classiques si nécessaire) :

```cpp
class RacletteTic
{
public:
    RacletteTic();
    void etudiant();
    void per();
    int racleur();
};
```

---

## Question 3 : 6 points

Le code suivant vise à garantir la sûreté sonore de l'aula, lors d'une répétition d'un orchestre de chambre. Chaque instrument est capable de générer un certain nombre de décibels, et les organisateurs ne veulent pas que la somme de tous ces décibels dépasse $100$ [^1]. Les musiciens seront représentés par des threads, et appelleront la méthode `accedeAula()` pour pouvoir entrer dans l'aula, et `quitteAula()` lorsqu'ils en sortent, en passant en paramètre le nombre de décibels de leur instrument.

```cpp
class AccesAula
{
private:
    PcoSemaphore sem{100};

public:
    void accedeAula(unsigned int db) {
        for (int i = 0; i < db; i++) {
            sem.acquire();
        }
    }

    void quitteAula(unsigned int db) {
        for (int i = 0; i < db; i++) {
            sem.release();
        }
    }
};
```

Analysez ce code, et indiquez ci-dessous s'il est fonctionnel ou non, en justifiant votre réponse. Dans le cas où il ne serait pas fonctionnel, modifiez-le pour qu'il le devienne.

[^1]: Oui, bon, d'accord, on fait abstraction du côté légèrement surréaliste de la situation et de la difficulté de répéter avec un sous-ensemble de l'ensemble.

---

## Question 4 : 6 points

Répondez aux questions suivantes en justifiant vos réponses.

1. Quelles sont les différences entre l'usage d'un mutex et celui d'un sémaphore initialisé à 1 ?
2. La fonction `PcoThread::join()` est potentiellement bloquante. Quand l'est-elle et quand ne l'est-elle pas ?
3. Le constructeur d'un sémaphore prend un entier non signé comme paramètre. Pourquoi pas un entier signé ? (La réponse *"Parce que ça n'a pas de sens"* n'est pas suffisante, justifiez)

---

## Question 5 : 6 points

Le code suivant a été proposé par un de vos collègues, lors de votre projet de semestre. Il vous demande de le relire afin d'y détecter de potentiels problèmes. En trouvez-vous ? Si oui, alors expliquez ce que vous avez trouvé, et pourquoi c'est problématique.

```cpp
const int N = 4;

class TheClass
{
public:
    // Initialise le vecteur avec N éléments à 0
    TheClass(int index) : m_index(index), m_vec(N, 0) {}

    // Cette fonction permet à un thread de signaler sa présence
    void signale(int index) {
        m_vec[index] += (1 << index);
    }

private:
    int m_index;
    std::vector<int> m_vec;
};

// Vecteur de N pointeurs sur objets
static std::vector<TheClass*> theVector(N);

void function(int i) {
    for (int j = 0; j < N; j++)
    {
        theVector[j]->signale(i);
    }
}

int main()
{
    std::vector<PcoThread*> threads(N);
    for (int i = 0; i < N; i++) {
        threads[i] = new PcoThread(function, i);
        theVector[i] = new TheClass(i);
    }

    for (int i = 0; i < N; i++) {
        threads[i]->join();
        delete threads[i];
    }

    return 0;
}
```