import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Footer from "./components/Footer.jsx";


// Konfigurerer sideruter og navigasjon for nettsiden
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";



/* Sider */

import Courses from "./Pages/Courses.jsx";
import CourseEditor from "./Pages/CourseEditor.jsx";
import Activities from "./Pages/Activities.jsx";
import { ActivityEditor } from "./Pages/ActivityEditor.jsx";
import News from "./Pages/News.jsx";
import NewsEditor from "./Pages/NewsEditor.jsx";
import About from "./Pages/About.jsx";
import Municipalities from "./Pages/Municipalities.jsx";
import Contact from "./Pages/Contact.jsx";
import Search from "./Pages/Search.jsx";
import Shop from "./Pages/Shop.jsx";
import { useCart } from "./Pages/cartContext.js";
import MyPage from "./Pages/MyPage.jsx";
import MemberProfileChange from "./Pages/MemberProfileChange.jsx";
import ResetPassword from "./Pages/ResetPassword.jsx";
import Membership, {
  MembershipAdminPage,
} from "./Pages/Membership.jsx";

import "./App.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

/* Dette er hovedsiden (forsiden) til nettsiden. */

function HomePage() {
  return (
    <main className="main-content">
      <section className="hero">
        <p>Velkommen til</p>

        <h1>Østfold Husflidslag</h1>

        <p className="hero-description">
          Vi ivaretar og utvikler husflid og håndverk kulturelt,
          sosialt og økonomisk i Østfold.
        </p>

        <Link className="hero-button" to="/kurs">
          Se våre kurs <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="cards" aria-label="Snarveier">
        <article className="card course-card">
          <span className="card-icon" aria-hidden="true">
            K
          </span>

          <h2>Kurs</h2>

          <p>Lær nye teknikker og utvikle ferdighetene dine.</p>

          <Link to="/kurs">
            Se kurs <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card activity-card">
          <span className="card-icon" aria-hidden="true">
            A
          </span>

          <h2>Aktiviteter</h2>

          <p>
            Bli med på arrangementer, møter og sosiale aktiviteter.
          </p>

          <Link to="/aktiviteter">
            Se aktiviteter <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card news-card">
          <span className="card-icon" aria-hidden="true">
            N
          </span>

          <h2>Nyheter</h2>

          <p>Få med deg det siste fra Østfold Husflidslag.</p>

          <Link to="/nyheter">
            Se nyheter <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card local-card">
          <span className="card-icon" aria-hidden="true">
            L
          </span>

          <h2>Lokale lag</h2>

          <p>Finn ditt nærmeste lokallag og se hva som skjer.</p>

          <Link to="/kommuner">
            Se mer <span aria-hidden="true">→</span>
          </Link>
        </article>
      </section>
    </main>
  );
}

/*  HELE NETTSIDEN
   Definerer felles oppsett og grunnleggende stil for nettsiden.*/

function App() {
  const { count } = useCart();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authCheckSequence = useRef(0);

  const refreshAuthentication = useCallback(() => {
    const sequence = ++authCheckSequence.current;

    Promise.all([
      fetch(`${API}/membership/me`, {
        credentials: "include",
      }),
      fetch(`${API}/auth/me`, {
        credentials: "include",
      }),
    ])
      .then((responses) => {
        if (sequence === authCheckSequence.current) {
          setIsAuthenticated(
            responses.some((response) => response.ok),
          );
        }
      })
      .catch((error) => {
        console.error(
          "Kunne ikke kontrollere innloggingsstatus.",
          error,
        );
      });
  }, []);

  useEffect(() => {
    refreshAuthentication();

    window.addEventListener(
      "set18-auth-change",
      refreshAuthentication,
    );

    window.addEventListener("focus", refreshAuthentication);

    return () => {
      window.removeEventListener(
        "set18-auth-change",
        refreshAuthentication,
      );

      window.removeEventListener(
        "focus",
        refreshAuthentication,
      );
    };
  }, [refreshAuthentication]);

  return (
    <>
      {/* Toppmeny */}
      <header>
        <Header count={count} isAuthenticated={isAuthenticated} />
      </header>

      {/* Sidemeny og valgt side */}
      <section className="page-layout">

        <Sidebar />

        {/* Sidene og nettadressene */}
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/kurs"
            element={<Courses />}
          />

          <Route
            path="/kurs/ny"
            element={<CourseEditor />}
          />

          <Route
            path="/kurs/:courseId/rediger"
            element={<CourseEditor />}
          />

          <Route
            path="/aktiviteter"
            element={<Activities />}
          />

          <Route
            path="/aktiviteter/ny"
            element={<ActivityEditor />}
          />

          <Route
            path="/aktiviteter/:activityId/rediger"
            element={<ActivityEditor />}
          />

          <Route
            path="/nyheter"
            element={<News />}
          />

          <Route
            path="/nyheter/ny"
            element={<NewsEditor />}
          />

          <Route
            path="/nyheter/:newsId/rediger"
            element={<NewsEditor />}
          />

          <Route
            path="/om-oss"
            element={<About />}
          />

          <Route
            path="/kommuner"
            element={<Municipalities />}
          />

          <Route
            path="/kontakt"
            element={<Contact />}
          />

          <Route
            path="/sok"
            element={<Search />}
          />

          <Route
            path="/nettbutikk"
            element={<Navigate to="/handlekurv" replace />}
          />
          <Route path="/handlekurv" element={<Shop />} />
          <Route path="/betaling" element={<Shop payment />} />

          <Route
            path="/medlemskap"
            element={<Membership />}
          />

          <Route
            path="/medlemskap/rediger"
            element={<MembershipAdminPage />}
          />

          <Route
            path="/admin"
            element={
              <Navigate to="/min-side" replace />
            }
          />

          <Route
            path="/min-side/endre-personopplysninger"
            element={<MemberProfileChange />}
          />

          <Route
            path="/min-side/nytt-passord"
            element={<ResetPassword />}
          />

          <Route
            path="/min-side"
            element={<MyPage />}
          />
        </Routes>
      </section>

      {/* Bunntekst */}
        <Footer />
    </>
  );
}

export default App;