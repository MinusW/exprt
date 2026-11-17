# HEIG-VD — Haute École d'Ingénierie et de Gestion du Canton de Vaud

**Cours :** Programmation Concurrente (PCO)  
**Semestre :** Automne 2021-2022  
**Évaluation :** Contrôle continu 1  
**Date :** 22.11.2021  
**Professeur :** Yann Thoma  

**Prénom :** ________________________  
**Nom :** ___________________________  

---

### Consignes
* Aucune documentation n'est permise, y compris la feuille de vos voisins.
* La calculatrice n'est pas autorisée.
* Aucune réclamation ne sera acceptée en cas d'utilisation du crayon.
* Ne pas utiliser de couleur rouge.

| Question | Points | Score |
| :--- | :---: | :---: |
| 1 | 6 | |
| 2 | 6 | |
| 3 | 6 | |
| 4 | 12 | |
| 5 | 12 | |
| **Total** | **42** | |

---

### Rappel sur les classes Pco

* `PcoSemaphore::PcoSemaphore(n)` : correspond à initialiser le sémaphore à $n$ ($n$ doit être $\ge 0$) ;
* `PcoSemaphore::acquire()` : correspond à $P(\text{sémaphore})$ ;
* `PcoSemaphore::release()` : correspond à $V(\text{sémaphore})$ ;
* `PcoMutex::lock()` : verrouille un mutex ;
* `PcoMutex::unlock()` : déverrouille un mutex ;
* `PcoThread()` : Constructeur, lance un thread ;
* `PcoThread::join()` : attend qu'un thread se termine.

---

## Question 1 : 6 points

Soit le code suivant :

```cpp
#define INDEX1 10
#define INDEX2 20
#define SIZE 100

std::vector<int> myvector(SIZE, 0); // Initialisation du vecteur de taille SIZE avec des 0
PcoMutex mutex1;
PcoMutex mutex2;

void function1()
{
    mutex1.lock();
    myvector[INDEX1]++;
    mutex1.unlock();
}

void function2()
{
    mutex2.lock();
    myvector[INDEX2] = myvector[INDEX2] + 3;
    mutex2.unlock();
}

void main()
{
    PcoThread t1(function1);
    PcoThread t2(function2);
    t1.join();
    t2.join();
    std::cout << myvector[INDEX1] << "," << myvector[INDEX2] << std::endl;
}
```

Est-ce que la sortie observée de ce programme sera toujours la même ?  
Si oui, justifiez, et si non modifiez le code tout en respectant sa sémantique[^1].

[^1]: Non, il n'est pas permis de faire uniquement `std::cout << "1, 3" << std::endl;`

---

## Question 2 : 6 points

Soit le code suivant :

```cpp
MyClassA objA;
MyClassB objB;
PcoSemaphore semA(1);
PcoSemaphore semB(1);

void function1()
{
    semA.acquire();
    objA.method();
    semA.release();
}

void function2()
{
    semB.acquire();
    objB.method();
    semB.release();
}

void function3()
{
    semA.acquire();
    objA.method();
    semB.acquire();
    objB.method();
    semB.release();
    semA.release();
}

void function4()
{
    semB.acquire();
    objB.method();
    semA.acquire();
    objA.method();
    semA.release();
    semB.release();
}

void main()
{
    PcoThread t1(function1);
    PcoThread t2(function2);
    PcoThread t3(function3);
    PcoThread t4(function4);
    t1.join();
    t2.join();
    t3.join();
    t4.join();
}
```

Les fonctions `MyClassA::method()` et `MyClassB::method()` ne sont pas thread-safe (mais ne dépendent pas l'une de l'autre), et donc le développeur a décidé d'utiliser un sémaphore pour protéger chacune d'elle. Le code est-il correct ? Si oui justifiez, et si non expliquez pourquoi et corrigez le code.

---

## Question 3 : 6 points

Soit le code suivant :

```cpp
class MyClass { // Here we only show the part of the class that is useful to us
public:
    void method1();
    void method2();
};

PcoThread *thread2;

void function2(MyClass &object)
{
    object.method1();
}

void function1()
{
    MyClass obj;
    // prepare the object
    thread2 = new PcoThread(function2, std::ref(obj));
    obj.method2();
}

void main()
{
    PcoThread thread1(function1);
    thread1.join();
    thread2->join();
    delete thread2;
}
```

Les fonctions `MyClass::method1()` et `MyClass::method2()` sont thread-safe et peuvent donc être appelées en parallèle sans problème. Le code est-il correct ? Si oui justifiez, et si non expliquez ce qui n'est pas bon et proposez des modifications (sous forme de texte, pas besoin de modifier du code).

*Pour rappel, `std::ref()` permet de passer une référence d'un objet à la fonction pour la création de threads. Ceci est nécessaire pour que la compilation se passe bien.*

---

## Question 4 : 12 points

Nous désirons réaliser le contrôle d'un départ d'une course populaire dans un canton voisin. Les threads coureurs devront se bloquer et attendre que le thread commissaire de course lance le coup de feu pour reprendre leur exécution. Il y a un certain nombre de coureurs, et celui-ci n'est pas limité. Les règles de la FENEC (Fédération Neuchâteloise des Enthousiastes de la Course) imposent que le coup de feu parte à une heure précise. Si un coureur n'est pas présent au moment du coup de feu mais arrive plus tard il ne participe pas à la course mais ne reste pas bloqué sur la ligne d'arrivée.

La modélisation se fait via une classe `DepartCourse` qui offre, outre un constructeur, deux fonctions :

* `bool coureurArrive()`, appelée par les coureurs. Cette fonction est bloquante si le coureur peut participer à la course. Elle retourne `true` si le coureur peut participer à la course, et `false` s'il est arrivé trop tard.
* `void coupDeFeu()`, appelée par le commissaire de course. Elle relâche tous les coureurs présents sur la ligne de départ.

Proposez une implémentation à base de sémaphores.

```cpp
class DepartCourse
{
public:
    DepartCourse();
    bool coureurArrive();
    void coupDeFeu();
};
```

---

## Question 5 : 12 points

Pour l'assemblée générale de la Société pour l'Elimination Minutieuse et Alambiquée des doryPHOREs (la SEMAPHORE), le système de votation est un peu particulier. En effet, la machine gérant les votations n'est capable de gérer qu'un certain nombre maximal de voix. Chaque membre possède un certain nombre de voix, et il faut alors garantir que la somme totale des voix présentes ne dépasse pas ce seuil. A l'entrée de la salle la machine doit donc vérifier l'arrivée des membres, qui devront rester dehors s'il n'y a plus de place pour eux. Dès qu'un membre quitte l'assemblée il libère alors un certain nombre de voix, ce qui peut permettre à une ou plusieurs personnes de rentrer.

Nous allons décrire ce comportement dans la classe `Votations`. Le nombre maximum de voix est défini via le paramètre du constructeur. Les méthodes `entre()` et `sort()` prennent en paramètre le nombre de voix de la personne désirant entrer ou sortir de la salle. La fonction `entre()` peut évidemment être bloquante s'il n'y a momentanément plus de place.

A vous d'implémenter cette classe, en vous aidant de sémaphores.

```cpp
class Votations {
public:
    Votations(unsigned int nbMaxVoix);
    void entre(unsigned int nbVoix);
    void sort(unsigned int nbVoix);
};
```